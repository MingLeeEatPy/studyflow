use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
  Manager, WebviewWindow, WindowEvent,
};

fn reveal(window: &WebviewWindow) {
  let _ = window.unminimize();
  let _ = window.show();
  let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
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
