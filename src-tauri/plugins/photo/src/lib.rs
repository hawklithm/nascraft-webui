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

// /// Get all photos from the device's album with detailed metadata
// #[tauri::command]
// async fn get_album_photos() -> Result<String, String> {
//     // This command will be handled by the Android plugin
//     Err("This command is only available on Android".to_string())
// }

// /// Read photo file content as base64 string
// #[tauri::command]
// async fn read_photo_data(uri: String) -> Result<String, String> {
//     // This command will be handled by the Android plugin
//     Err("This command is only available on Android".to_string())
// }

// /// Get photo thumbnail as base64
// #[tauri::command]
// async fn get_photo_thumbnail(uri: String, width: Option<u32>, height: Option<u32>) -> Result<String, String> {
//     // This command will be handled by the Android plugin
//     Err("This command is only available on Android".to_string())
// }