fn main() {
  println!("cargo:rustc-check-cfg=cfg(desktop)");
  println!("cargo:rustc-check-cfg=cfg(mobile)");

  if std::env::var("TAURI_CONFIG").is_err() {
    return;
  }

  tauri_build::build();
}
