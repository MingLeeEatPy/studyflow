use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
  AppHandle, Emitter, Manager, WebviewWindow, WindowEvent,
};

fn reveal(window: &WebviewWindow) {
  let _ = window.unminimize();
  let _ = window.show();
  let _ = window.set_focus();
}

fn window_for(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
  if label != "main" && label != "timer" {
    return Err("unknown StudyFlow window".into());
  }
  app.get_webview_window(label).ok_or_else(|| "StudyFlow window is unavailable".into())
}

#[tauri::command]
fn reveal_studyflow_window(app: AppHandle, label: String) -> Result<(), String> {
  let window = window_for(&app, &label)?;
  reveal(&window);
  Ok(())
}

#[tauri::command]
fn hide_studyflow_window(app: AppHandle, label: String) -> Result<(), String> {
  let window = window_for(&app, &label)?;
  window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn send_desktop_timer_action(app: AppHandle, action: String, kind: String) -> Result<(), String> {
  if action != "expand" && action != "finish" {
    return Err("unknown desktop timer action".into());
  }
  if kind != "study" && kind != "meditation" {
    return Err("unknown desktop timer kind".into());
  }
  app.emit_to("main", "studyflow:desktop-timer-action", serde_json::json!({ "action": action, "kind": kind }))
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
      reveal_studyflow_window,
      hide_studyflow_window,
      send_desktop_timer_action,
    ])
    .setup(|app| {
      let open_main = MenuItem::with_id(app, "open-main", "打开 StudyFlow", true, None::<&str>)?;
      let open_timer = MenuItem::with_id(app, "open-timer", "显示计时器", true, None::<&str>)?;
      let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&open_main, &open_timer, &quit])?;

      TrayIconBuilder::new()
        .icon(app.default_window_icon().expect("application icon is required").clone())
        .tooltip("StudyFlow")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "open-main" => {
            if let Some(window) = app.get_webview_window("main") {
              reveal(&window);
            }
          }
          "open-timer" => {
            if let Some(window) = app.get_webview_window("timer") {
              reveal(&window);
            }
          }
          "quit" => app.exit(0),
          _ => {}
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if window.label() == "main" && matches!(event, WindowEvent::CloseRequested { .. }) {
        if let WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
