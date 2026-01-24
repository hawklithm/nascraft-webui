use tauri::{Emitter, Manager};
use notify::{recommended_watcher, RecursiveMode, Watcher};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use notify::event::EventKind;
use std::path::{Path, PathBuf};
use std::io::{Read, Seek, SeekFrom, Write};
use chrono::Local;

#[derive(Debug, Deserialize)]
struct HttpProxyRequest {
  url: String,
  method: Option<String>,
  headers: Option<HashMap<String, String>>,
  body: Option<Vec<u8>>,
}

const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

static APP_LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static FILE_LOGGER: OnceLock<FileLogger> = OnceLock::new();

macro_rules! file_log {
  ($lvl:expr, $($arg:tt)*) => {{
    let ts_ms = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.as_millis())
      .unwrap_or(0);
    let line = format!("{} [{}] {}", ts_ms, $lvl, format!($($arg)*));
    if let Some(l) = FILE_LOGGER.get() {
      let _ = l.append_line(&line);
    }
  }};
}

macro_rules! file_info {
  ($($arg:tt)*) => { file_log!("INFO", $($arg)*); };
}

macro_rules! file_warn {
  ($($arg:tt)*) => { file_log!("WARN", $($arg)*); };
}

macro_rules! file_error {
  ($($arg:tt)*) => { file_log!("ERROR", $($arg)*); };
}

struct FileLogger {
  path: PathBuf,
  lock: Mutex<()>,
}

impl FileLogger {
  fn new(path: PathBuf) -> Self {
    Self {
      path,
      lock: Mutex::new(()),
    }
  }

  fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create log dir: {}", e))?;
    }
    Ok(())
  }

  fn truncate_if_needed_locked(&self, incoming_len: u64) -> Result<(), String> {
    let cur_len = match std::fs::metadata(&self.path) {
      Ok(m) => m.len(),
      Err(_) => 0,
    };

    if cur_len + incoming_len <= MAX_LOG_BYTES {
      return Ok(());
    }
    let _ = std::fs::OpenOptions::new()
      .create(true)
      .write(true)
      .truncate(true)
      .open(&self.path);
    Ok(())
  }

  fn append_line(&self, line: &str) -> Result<(), String> {
    let _g = self.lock.lock().map_err(|_| "log lock poisoned".to_string())?;
    Self::ensure_parent_dir(&self.path)?;
    self.truncate_if_needed_locked(line.as_bytes().len() as u64)?;

    let mut f = std::fs::OpenOptions::new()
      .create(true)
      .append(true)
      .open(&self.path)
      .map_err(|e| format!("Failed to open log file: {}", e))?;

    f.write_all(line.as_bytes())
      .and_then(|_| f.write_all(b"\n"))
      .map_err(|e| format!("Failed to write log file: {}", e))?;
    Ok(())
  }
}

impl log::Log for FileLogger {
  fn enabled(&self, _metadata: &log::Metadata) -> bool {
    true
  }

  fn log(&self, record: &log::Record) {
    if !self.enabled(record.metadata()) {
      return;
    }
    let ts_ms = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.as_millis())
      .unwrap_or(0);
    let line = format!("{} [{}] {}", ts_ms, record.level(), record.args());
    let _ = self.append_line(&line);
  }

  fn flush(&self) {}
}

#[derive(Debug, Deserialize)]
struct WebLogPayload {
  level: String,
  message: String,
}

#[derive(Debug, Serialize)]
struct AppLogInfo {
  log_file: String,
}

fn get_logger() -> Result<&'static FileLogger, String> {
  FILE_LOGGER.get().ok_or_else(|| "logger not initialized".to_string())
}

#[tauri::command]
fn get_app_log_info() -> Result<AppLogInfo, String> {
  let p = APP_LOG_PATH
    .get()
    .ok_or_else(|| "log path not initialized".to_string())?;
  Ok(AppLogInfo {
    log_file: p.display().to_string(),
  })
}

#[tauri::command]
fn append_web_log(payload: WebLogPayload) -> Result<(), String> {
  let ts_ms = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let line = format!("{} [WEB:{}] {}", ts_ms, payload.level, payload.message);
  get_logger()?.append_line(&line)
}

#[tauri::command]
fn read_app_log(max_bytes: Option<u64>) -> Result<String, String> {
  let max_bytes = max_bytes.unwrap_or(512 * 1024).min(MAX_LOG_BYTES);
  let p = APP_LOG_PATH
    .get()
    .ok_or_else(|| "log path not initialized".to_string())?;

  let mut f = std::fs::OpenOptions::new()
    .read(true)
    .open(p)
    .map_err(|e| format!("Failed to open log file: {}", e))?;
  let len = f
    .metadata()
    .map(|m| m.len())
    .unwrap_or(0);

  let start = if len > max_bytes { len - max_bytes } else { 0 };
  f.seek(SeekFrom::Start(start))
    .map_err(|e| format!("Failed to seek log file: {}", e))?;

  let mut buf = Vec::new();
  f.read_to_end(&mut buf)
    .map_err(|e| format!("Failed to read log file: {}", e))?;
  Ok(String::from_utf8_lossy(&buf).to_string())
}

#[cfg(not(mobile))]
#[tauri::command]
fn read_desktop_file_bytes(path: String) -> Result<Vec<u8>, String> {
  std::fs::read(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[cfg(mobile)]
#[tauri::command]
fn read_desktop_file_bytes(_path: String) -> Result<Vec<u8>, String> {
  Err("read_desktop_file_bytes is not supported on mobile".to_string())
}

#[cfg(not(mobile))]
struct DesktopWatcherState {
  watcher: notify::RecommendedWatcher,
  watched: std::collections::HashSet<std::path::PathBuf>,
}

#[cfg(not(mobile))]
static DESKTOP_WATCHER: OnceLock<Mutex<DesktopWatcherState>> = OnceLock::new();

#[cfg(target_os = "android")]
#[tauri::command]
fn update_desktop_watch_dirs(app: tauri::AppHandle, watch_dirs: Vec<String>) -> Result<(), String> {
     panic!("update_desktop_watch_dirs is not supported on mobile");
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn update_desktop_watch_dirs(app: tauri::AppHandle, watch_dirs: Vec<String>) -> Result<(), String> {
  use std::collections::HashSet;
  use std::path::PathBuf;

  let app_for_cb = app.clone();
  let watcher_mutex = DESKTOP_WATCHER.get_or_init(|| {
    let watcher = recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
      let event = match res {
        Ok(e) => e,
        Err(e) => {
          file_info!("desktop watcher error: {}", e);
          return;
        }
      };

      match event.kind {
        EventKind::Create(_) => {
          for p in event.paths {
            let payload = p.to_string_lossy().to_string();
            let _ = app_for_cb.emit("nascraft:file-created", payload);
          }
        }
        _ => {}
      }
    }).map_err(|e| e.to_string()).unwrap();

    Mutex::new(DesktopWatcherState {
      watcher,
      watched: HashSet::new(),
    })
  });

  let mut state = watcher_mutex.lock().map_err(|_| "desktop watcher lock poisoned".to_string())?;
  let desired: HashSet<PathBuf> = watch_dirs.into_iter().filter(|s| !s.trim().is_empty()).map(PathBuf::from).collect();

  // Unwatch removed
  let removed: Vec<PathBuf> = state.watched.difference(&desired).cloned().collect();
  for p in removed {
    let _ = state.watcher.unwatch(&p);
    state.watched.remove(&p);
  }

  // Watch added
  let added: Vec<PathBuf> = desired.difference(&state.watched).cloned().collect();
  for p in added {
    state.watcher.watch(&p, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    state.watched.insert(p);
  }

  Ok(())
}

//#[cfg(not(mobile))]
#[tauri::command]
async fn test_mdns_discovery(timeout_ms: Option<u64>) -> Result<Vec<String>, String> {
  use mdns_sd::{ServiceDaemon, ServiceEvent};
  
  let timeout_ms = timeout_ms.unwrap_or(3000);
  let service_type = "_services._dns-sd._udp.local."; // 发现所有服务
  
  file_info!("Starting mDNS test discovery for all services");
  
  let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
  let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;
  
  let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
  let mut discovered_services = Vec::new();
  
  while std::time::Instant::now() < deadline {
    let remaining = deadline.saturating_duration_since(std::time::Instant::now());
    match receiver.recv_timeout(std::cmp::min(remaining, std::time::Duration::from_millis(500))) {
      Ok(ServiceEvent::ServiceResolved(resolved)) => {
        let service_info = format!("{} - {}:{}", 
          resolved.get_fullname(),
          resolved.get_hostname(),
          resolved.get_port()
        );
        file_info!("Test discovery found: {}", service_info);
        discovered_services.push(service_info);
      }
      Ok(_) => {}
      Err(e) => {
        if !e.to_string().contains("time") {
          file_info!("Test discovery error: {}", e);
        }
      }
    }
  }
  
  let _ = mdns.shutdown();
  file_info!("Test discovery finished, found {} services", discovered_services.len());
  Ok(discovered_services)
}

#[cfg(not(mobile))]
#[tauri::command]
async fn discover_nascraft_services(timeout_ms: Option<u64>, _broadcast_addrs: Option<Vec<String>>) -> Result<Vec<MdnsDiscoveredServer>, String> {
  use mdns_sd::{ServiceDaemon, ServiceEvent};
  use std::collections::HashSet;

  let timeout_ms = timeout_ms.unwrap_or(5000); // 增加超时时间到5秒
  let service_types = vec![
    "_nascraft._tcp.local.",
    "_http._tcp.local.", // 尝试通用的HTTP服务类型
  ];

  file_info!("Starting mDNS discovery with timeout {}ms", timeout_ms);
  
  let mut all_services = Vec::new();
  
  for service_type in service_types {
    file_info!("Trying to discover services of type: {}", service_type);
    
    let mdns = match ServiceDaemon::new() {
      Ok(daemon) => daemon,
      Err(e) => {
        file_info!("Failed to create mDNS daemon for {}: {}", service_type, e);
        continue;
      }
    };
    
    let receiver = match mdns.browse(service_type) {
      Ok(rx) => rx,
      Err(e) => {
        file_info!("Failed to start browsing for {}: {}", service_type, e);
        let _ = mdns.shutdown();
        continue;
      }
    };
    
    file_info!("mDNS browsing started for: {}", service_type);

    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
    let mut out: Vec<MdnsDiscoveredServer> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    while std::time::Instant::now() < deadline {
      let remaining = deadline.saturating_duration_since(std::time::Instant::now());
      match receiver.recv_timeout(std::cmp::min(remaining, std::time::Duration::from_millis(500))) {
        Ok(ServiceEvent::SearchStarted(_ty)) => {
          file_info!("mDNS search started for {}", service_type);
        }
        Ok(ServiceEvent::ServiceFound(_fullname, _ty)) => {
          file_info!("mDNS service found for {}", service_type);
        }
        Ok(ServiceEvent::ServiceResolved(resolved)) => {
          file_info!("mDNS service resolved: {:?}", resolved.get_fullname());
          
          if !resolved.is_valid() {
            file_info!("Service resolved but invalid, skipping");
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
            file_info!("No IPv4 addresses found, using hostname: {}", hostname);
            v4_list.push(hostname.clone());
          }

          // Derive instance name from fullname: <instance>.<service_type>
          let instance_name = fullname.clone()          
            .strip_suffix(service_type)
            .and_then(|s| s.strip_suffix('.'))
            .unwrap_or(fullname.clone().as_str())
            .to_string();

          let port = resolved.get_port();
          file_info!("Found service: instance={}, hostname={}, ips={:?}, port={}", 
                    instance_name, hostname, v4_list, port);

          out.push(MdnsDiscoveredServer {
            instance_name,
            service_type: service_type.to_string(),
            hostname,
            ip_v4: v4_list,
            port,
          });
        }
        Ok(_other) => {}
        Err(e) => {
          // 超时是正常的，不记录为错误
          if !e.to_string().contains("timed out") && !e.to_string().contains("timeout") {
            file_info!("mDNS discovery error for {}: {}", service_type, e);
          }
        }
      }
    }

    file_info!("mDNS discovery finished for {}: services_found={}", service_type, out.len());
    let _ = mdns.shutdown();
    all_services.extend(out);
  }

  file_info!("Total mDNS services found: {}", all_services.len());
  
  // 去重：基于hostname和port
  let mut unique_services = Vec::new();
  let mut seen_keys = HashSet::new();
  
  for service in all_services {
    let key = format!("{}:{}", service.hostname, service.port);
    if !seen_keys.contains(&key) {
      seen_keys.insert(key);
      unique_services.push(service);
    }
  }
  
  file_info!("Unique services after deduplication: {}", unique_services.len());
  Ok(unique_services)
}

#[cfg(mobile)]
#[tauri::command]
async fn discover_nascraft_services(timeout_ms: Option<u64>, broadcast_addrs: Option<Vec<String>>) -> Result<Vec<MdnsDiscoveredServer>, String> {
  panic!("discover_nascraft_services is not implemented on mobile")
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
  tauri::Builder::default()  .plugin(tauri_plugin_fs::init())
  .plugin(tauri_plugin_os::init())
  .plugin(tauri_plugin_dialog::init())
  .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![http_proxy_fetch, discover_nascraft_services, test_mdns_discovery, update_desktop_watch_dirs,read_desktop_file_bytes,
      get_app_log_info,
      read_app_log,
      append_web_log
    ])
    .setup(|app| {
      let log_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {}", e))?
        .join("logs");
      let log_path = log_dir.join("nascraft.log");

      let _ = APP_LOG_PATH.set(log_path.clone());
      let logger = FILE_LOGGER.get_or_init(|| FileLogger::new(log_path.clone()));

      if log::set_logger(logger).is_ok() {
        log::set_max_level(log::LevelFilter::Info);
      }
      let _ = logger.append_line(&format!(
        "{} [INFO] logger initialized: {}",
        Local::now().format("%Y-%m-%d %H:%M:%S"),
          // .duration_since(std::time::UNIX_EPOCH)
          // .map(|d| d.as_millis())
          // .unwrap_or(0),
        log_path.display()
      ));

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
