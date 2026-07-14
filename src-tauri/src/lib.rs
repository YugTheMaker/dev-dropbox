use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;

#[allow(dead_code)]
struct DaemonState {
    child: Arc<Mutex<Option<Child>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let daemon_child = Arc::new(Mutex::new(None));
    let daemon_child_clone = daemon_child.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            // Setup logging plugin in debug mode
            #[cfg(debug_assertions)]
            {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }

            // 1. Resolve path to daemon/dist/index.js
            let mut daemon_path = std::env::current_dir().unwrap().join("daemon/dist/index.js");
            if !daemon_path.exists() {
                // Try parent or typical cargo run paths
                daemon_path = std::env::current_dir().unwrap().join("../daemon/dist/index.js");
            }

            // In production release, use the tauri packaged resource path
            #[cfg(not(debug_assertions))]
            {
                if let Ok(res_path) = app.path().resolve("daemon/dist/index.js", BaseDirectory::Resource) {
                    daemon_path = res_path;
                }
            }

            println!("Spawning background daemon from path: {:?}", daemon_path);

            // Resolve node path: try default "node", then check common absolute paths on macOS
            let mut node_bin = "node".to_string();
            #[cfg(target_os = "macos")]
            {
                let common_paths = vec![
                    "/opt/homebrew/bin/node",
                    "/usr/local/bin/node",
                    "/usr/bin/node",
                ];
                for path in common_paths {
                    if std::path::Path::new(path).exists() {
                        node_bin = path.to_string();
                        break;
                    }
                }
            }

            // 2. Spawn the Node.js process
            let mut cmd = Command::new(node_bin);
            cmd.arg(daemon_path);
            
            // Set Node environment if needed
            cmd.env("PORT", "36911");

            match cmd.spawn() {
                Ok(child) => {
                    println!("Successfully spawned Dev Dropbox background daemon process.");
                    *daemon_child_clone.lock().unwrap() = Some(child);
                }
                Err(e) => {
                    eprintln!("Failed to spawn background daemon process: {}", e);
                }
            }

            // 3. Set up System Tray Menu
            let quit_i = MenuItem::with_id(app.handle(), "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app.handle(), "show", "Open Dev Dropbox", true, None::<&str>)?;
            let menu = Menu::with_items(app.handle(), &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button_state: _, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 4. Intercept close event to hide window instead of closing
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .manage(DaemonState { child: daemon_child.clone() })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // 5. Run application and handle cleanup on exit
    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Ok(mut lock) = daemon_child.lock() {
                if let Some(mut child) = lock.take() {
                    println!("Killing background daemon process...");
                    let _ = child.kill();
                }
            }
        }
    });
}
