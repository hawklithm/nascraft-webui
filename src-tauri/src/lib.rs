use tauri::Emitter;
use notify::{Watcher, RecursiveMode,recommended_watcher};
use std::sync::mpsc::channel;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default().plugin(tauri_plugin_fs::init())
  .plugin(tauri_plugin_os::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        let (tx, rx) = channel();
        let mut watcher = recommended_watcher(tx).unwrap();
        // Watch the specified directory
        watcher.watch(std::path::Path::new("D:\\workspace\\test"), RecursiveMode::Recursive).unwrap();

        loop {
          match rx.recv() {
            Ok(event) => {
              println!("File change detected: {:?}", event);
              let event_str = format!("{:?}", event);
              handle.emit("file-changed", event_str).unwrap();
            },
            Err(e) => println!("watch error: {:?}", e),
          }
        }
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
