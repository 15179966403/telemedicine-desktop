// 互联网医院桌面应用 - Rust 后端
use tauri::Manager;

mod commands;
mod database;
mod models;
mod services;
mod utils;

use commands::*;
use commands::window::WindowManagerState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(WindowManagerState::default())
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
            mark_messages_as_read,
            get_unread_message_count,
            sync_pending_messages,

            // 窗口管理命令
            create_new_window,
            close_window_by_id,
            focus_window_by_id,
            get_all_windows,
            get_window_info,
            update_window_data,
            get_resource_usage,
            check_window_limits,
            minimize_window,
            maximize_window,

            // 文件管理命令
            save_file_locally,
            read_file_from_local,
            file_exists,
            delete_local_file,
            compress_file,
            encrypt_file,
            decrypt_file,
            add_file_to_cache,
            get_file_from_cache,
            is_file_in_cache,
            remove_file_from_cache,
            update_cache_last_accessed,
            cleanup_file_cache,
            cleanup_expired_cache_files,
            cleanup_lru_cache_files,
            cleanup_oversized_cache,
            get_file_cache_statistics,
            get_cache_file_list,
            clear_all_file_cache,
            warmup_file_cache,
            update_file_cache_record,
            delete_file_cache_record,
            get_file_cache_info,
            update_file_last_accessed,

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
