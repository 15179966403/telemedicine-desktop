// 互联网医院桌面应用 - Rust 后端
use tauri::Manager;

mod commands;
mod database;
mod models;
mod services;
mod utils;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .invoke_handler(tauri::generate_handler![
            // 认证相关命令
            auth_login,
            auth_logout,
            auth_refresh_token,
            auth_validate_session,

            // 患者管理命令
            get_patient_list,
            get_patient_detail,
            update_patient_tags,
            search_patients,

            // 消息相关命令
            send_message,
            get_message_history,
            upload_file,

            // 窗口管理命令
            create_new_window,
            close_window_by_id,
            focus_window_by_id,

            // 数据库相关命令
            init_database,
            sync_data,
        ])
        .setup(|app| {
            // 初始化数据库
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::init_database(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
