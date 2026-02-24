use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// ── Bug Report → GitHub Issues (server-side, token never reaches the frontend) ──

#[derive(Deserialize)]
struct BugReportInput {
    title: String,
    description: String,
    include_logs: bool,
    date: String,
}

#[tauri::command]
async fn create_bug_report(input: BugReportInput) -> Result<String, String> {
    // Validation des entrees
    let title = input.title.trim().to_string();
    let description = input.description.trim().to_string();

    if title.is_empty() || description.is_empty() {
        return Err("Le titre et la description sont requis.".to_string());
    }
    if title.len() > 200 {
        return Err("Le titre ne doit pas depasser 200 caracteres.".to_string());
    }
    if description.len() > 5000 {
        return Err("La description ne doit pas depasser 5000 caracteres.".to_string());
    }

    let token = option_env!("BUG_REPORT_TOKEN")
        .ok_or("Service de bug report non disponible dans cette version.")?;

    let system_info = format!(
        "- **App**: GuideME Ramadan v{}\n- **Date**: {}",
        env!("CARGO_PKG_VERSION"),
        input.date
    );

    let mut body_parts = vec![
        "## Description".to_string(),
        description,
        String::new(),
        "## Informations système".to_string(),
        system_info,
    ];
    if input.include_logs {
        body_parts.push("\n> Logs de l'application joints par l'utilisateur".to_string());
    }
    let body = body_parts.join("\n");

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.github.com/repos/SofianeBel/myramadan/issues")
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", "GuideME-Ramadan")
        .json(&serde_json::json!({
            "title": format!("[Bug] {}", title),
            "body": body,
            "labels": ["bug"]
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau : {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = err_body["message"].as_str().unwrap_or("Erreur inconnue");
        eprintln!("[bug-report] Erreur GitHub API: HTTP {} — {}", status, msg);
        return Err("Impossible de creer le rapport. Reessayez plus tard.".to_string());
    }

    Ok("Issue créée avec succès.".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![create_bug_report])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // ── Autostart plugin ──
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))?;

            // ── System tray ──
            let show_item =
                MenuItem::with_id(app, "show", "Ouvrir GuideME", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(
                    app.default_window_icon()
                        .expect("App icon must be configured in tauri.conf.json")
                        .clone(),
                )
                .tooltip("GuideME - Ramadan")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ── Hide main window on close instead of quitting (close-to-tray) ──
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
