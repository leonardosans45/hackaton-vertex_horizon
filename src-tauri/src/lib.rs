#[tauri::command]
fn greet(name: &str) -> String {
    format!("¡Hola, {}! Has sido saludado desde Rust en Vertex Horizon.", name)
}

#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "app_name": "Vertex Horizon"
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .invoke_handler(tauri::generate_handler![greet, get_system_info])
    .setup(|app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

