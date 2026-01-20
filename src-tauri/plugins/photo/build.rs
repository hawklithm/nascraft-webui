const COMMANDS: &[&str] = &["checkAndRequestPermissions", "openAppSettings", "get_album_photos", "read_photo_data", "get_photo_thumbnail"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}

