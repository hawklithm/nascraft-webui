//! Tauri plugin for accessing photo gallery on mobile platforms

use tauri::{plugin::{Builder, TauriPlugin}, Runtime};

/// Initializes the photo plugin
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("photo")
        .setup(|app, api| {
            // Android platform specific setup
            #[cfg(target_os = "android")] {
                let handle = api.register_android_plugin("app.tauri.photo", "PhotoPlugin")?;
                // You can manage plugin state here if needed
                // app.manage(some_state);
            }
            
            // Non-Android platform setup
            #[cfg(not(target_os = "android"))] {
                // Desktop-specific setup or placeholder
                // app.manage(DesktopPhotoManager::default());
            }
            
            Ok(())
        })
        .js_init_script(include_str!("../guest-js/index.js"))
        .invoke_handler(tauri::generate_handler![])
        .build()
}