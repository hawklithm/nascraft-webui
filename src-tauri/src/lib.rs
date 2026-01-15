use tauri::Emitter;
use notify::{recommended_watcher, Config, RecursiveMode, Watcher};
use std::{sync::mpsc::channel, time::Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use log::{info, warn};

#[derive(Debug, Deserialize)]
struct HttpProxyRequest {
  url: String,
  method: Option<String>,
  headers: Option<HashMap<String, String>>,
  body: Option<Vec<u8>>,
}

#[cfg(not(mobile))]
#[tauri::command]
async fn discover_nascraft_services(timeout_ms: Option<u64>) -> Result<Vec<MdnsDiscoveredServer>, String> {
  use mdns_sd::{ServiceDaemon, ServiceEvent};
  use std::collections::HashSet;

  let timeout_ms = timeout_ms.unwrap_or(1500);
  let service_type = "_nascraft._tcp.local.";

  let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
  let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;
  info!("mDNS browse started: type={}, timeout_ms={}", service_type, timeout_ms);

  let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
  let mut out: Vec<MdnsDiscoveredServer> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  while std::time::Instant::now() < deadline {
    let remaining = deadline.saturating_duration_since(std::time::Instant::now());
    match receiver.recv_timeout(std::cmp::min(remaining, std::time::Duration::from_millis(250))) {
      Ok(ServiceEvent::SearchStarted(_ty)) => {}
      Ok(ServiceEvent::ServiceFound(_fullname, _ty)) => {}
      Ok(ServiceEvent::ServiceResolved(resolved)) => {
        if !resolved.is_valid() {
          continue;
        }
        let fullname = resolved.get_fullname().to_string();
        if seen.contains(&fullname) {
          continue;
        }
        seen.insert(fullname.clone());

        let mut v4_list: Vec<String> = resolved
          .get_addresses_v4()
          .into_iter()
          .map(|ip| ip.to_string())
          .collect();
        v4_list.sort();

        // Some environments might not provide an A record; fall back to hostname.
        let hostname = resolved.get_hostname().to_string();
        if v4_list.is_empty() {
          v4_list.push(hostname.clone());
        }

        // Derive instance name from fullname: <instance>.<service_type>
        let instance_name = fullname.clone()          
          .strip_suffix(service_type)
          .and_then(|s| s.strip_suffix('.'))
          .unwrap_or(fullname.clone().as_str())
          .to_string();

        out.push(MdnsDiscoveredServer {
          instance_name,
          service_type: service_type.to_string(),
          hostname,
          ip_v4: v4_list,
          port: resolved.get_port(),
        });
      }
      Ok(_other) => {}
      Err(_e) => {}
    }
  }

  let _ = mdns.shutdown();
  Ok(out)
}

#[cfg(mobile)]
#[tauri::command]
async fn discover_nascraft_services(timeout_ms: Option<u64>) -> Result<Vec<MdnsDiscoveredServer>, String> {
  use serde::{Deserialize, Serialize};
  use std::collections::HashSet;
  use tokio::net::UdpSocket;

  #[derive(Debug, Serialize)]
  struct Probe {
    t: String,
    v: u32,
  }

  #[derive(Debug, Deserialize)]
  struct Resp {
    t: String,
    v: u32,
    name: Option<String>,
    proto: Option<String>,
    port: Option<u16>,
  }

  let timeout_ms = timeout_ms.unwrap_or(1500);
  let discovery_port: u16 = 53530;
  let service_type = "_nascraft._udp.local.";

  let sock = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| e.to_string())?;
  sock.set_broadcast(true).map_err(|e| e.to_string())?;

  let probe = Probe {
    t: "nascraft_discover".to_string(),
    v: 1,
  };
  let payload = serde_json::to_vec(&probe).map_err(|e| e.to_string())?;

  // Send to limited broadcast. On some networks, 255.255.255.255 is restricted, but this is a good default.
  let broadcast_addr = format!("255.255.255.255:{}", discovery_port);
  let _ = sock.send_to(&payload, &broadcast_addr).await;

  let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
  let mut out: Vec<MdnsDiscoveredServer> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();
  let mut buf = vec![0u8; 2048];

  while std::time::Instant::now() < deadline {
    let remaining = deadline.saturating_duration_since(std::time::Instant::now());
    let per_recv = std::cmp::min(remaining, std::time::Duration::from_millis(250));

    match tokio::time::timeout(per_recv, sock.recv_from(&mut buf)).await {
      Ok(Ok((n, peer))) => {
        let resp: Result<Resp, _> = serde_json::from_slice(&buf[..n]);
        let resp = match resp {
          Ok(r) => r,
          Err(_) => continue,
        };

        if resp.t != "nascraft_here" || resp.v != 1 {
          continue;
        }

        let port = resp.port.unwrap_or(8080);
        let ip = peer.ip().to_string();
        let key = format!("{}:{}", ip, port);
        if seen.contains(&key) {
          continue;
        }
        seen.insert(key);

        out.push(MdnsDiscoveredServer {
          instance_name: resp.name.unwrap_or_else(|| "nascraft".to_string()),
          service_type: service_type.to_string(),
          hostname: ip.clone(),
          ip_v4: vec![ip],
          port,
        });
      }
      Ok(Err(_e)) => {}
      Err(_elapsed) => {}
    }
  }

  Ok(out)
}

#[derive(Debug, Serialize)]
struct HttpProxyResponse {
  status: u16,
  status_text: String,
  headers: HashMap<String, String>,
  body: Vec<u8>,
}

#[derive(Debug, Serialize)]
struct MdnsDiscoveredServer {
  instance_name: String,
  service_type: String,
  hostname: String,
  ip_v4: Vec<String>,
  port: u16,
}

#[tauri::command]
async fn http_proxy_fetch(req: HttpProxyRequest) -> Result<HttpProxyResponse, String> {
  let method = req.method.unwrap_or_else(|| "GET".to_string());
  let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;

  let client = reqwest::Client::builder()
    .build()
    .map_err(|e| e.to_string())?;

  let mut request = client.request(method, &req.url);

  if let Some(headers) = req.headers {
    for (k, v) in headers {
      request = request.header(k, v);
    }
  }

  if let Some(body) = req.body {
    request = request.body(body);
  }

  let resp = request.send().await.map_err(|e| e.to_string())?;
  let status = resp.status();
  let status_text = status
    .canonical_reason()
    .unwrap_or("")
    .to_string();

  let mut out_headers: HashMap<String, String> = HashMap::new();
  for (k, v) in resp.headers().iter() {
    if let Ok(s) = v.to_str() {
      out_headers.insert(k.to_string(), s.to_string());
    }
  }

  let body = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();

  Ok(HttpProxyResponse {
    status: status.as_u16(),
    status_text,
    headers: out_headers,
    body,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default().plugin(tauri_plugin_fs::init())
  .plugin(tauri_plugin_os::init())
  .plugin(tauri_plugin_dialog::init())
  .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![http_proxy_fetch, discover_nascraft_services])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // let handle = app.handle().clone();
      // std::thread::spawn(move || {
      //   let (tx, rx) = channel();
      //   let mut watcher = recommended_watcher(tx).unwrap();
        // Watch the specified directory
        // watcher.configure(Config::default().with_poll_interval(Duration::from_secs(60))).unwrap();
        // watcher.watch(std::path::Path::new("D:\\workspace\\test"), RecursiveMode::Recursive).unwrap();

        // loop {
        //   match rx.recv() {
        //     Ok(event) => {
        //       println!("File change detected: {:?}", event);
        //       let event_str = format!("{:?}", event);
        //       handle.emit("file-changed", event_str).unwrap();
        //     },
        //     Err(e) => println!("watch error: {:?}", e),
        //   }
        // }
      // });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
