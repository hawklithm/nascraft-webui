use tauri::Emitter;
use notify::{recommended_watcher, Config, RecursiveMode, Watcher};
use std::{sync::mpsc::channel, time::Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct HttpProxyRequest {
  url: String,
  method: Option<String>,
  headers: Option<HashMap<String, String>>,
  body: Option<Vec<u8>>,
}

#[derive(Debug, Serialize)]
struct HttpProxyResponse {
  status: u16,
  status_text: String,
  headers: HashMap<String, String>,
  body: Vec<u8>,
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
    .invoke_handler(tauri::generate_handler![http_proxy_fetch])
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
