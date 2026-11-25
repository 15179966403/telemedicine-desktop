// 健康管理桌面应用 - Rust 后端
use tauri::Manager;

mod commands;
mod database;
mod models;
mod services;
mod utils;

use commands::*;
use commands::window::WindowManagerState;
use commands::websocket::WebSocketManagerState;
use commands::security::SecurityServiceState;
use services::{WebSocketManager, SecurityService};
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(WindowManagerState::default())
        .manage(Arc::new(Mutex::new(WebSocketManager::new())) as WebSocketManagerState)
        .manage(Arc::new(Mutex::new(SecurityService::new(300))) as SecurityServiceState) // 5分钟自动锁屏
        .invoke_handler(tauri::generate_handler![
            // 认证相关命令
            auth_login,
            auth_logout,
            auth_refresh_token,
            auth_validate_session,
            auth_save_session,

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

            // 体检报告与健管方案本地文件管理命令
            get_report_storage_dir,
            set_report_storage_dir,
            select_report_folder_dialog,
            check_report_file_status,
            download_single_report_file,
            download_batch_report_files,
            open_report_local_file,
            open_report_local_folder,
            clean_single_report_files,
            clean_customer_report_files,
            clean_all_report_files,
            check_scheme_file_status,
            download_scheme_file,
            clean_single_scheme_file,
            get_pdf_file_bytes,

            // 客户随访便签（文本与照片）相关命令
            get_customer_memo,
            save_customer_memo_content,
            add_memo_image,
            read_memo_image,
            delete_memo_image,
            open_memo_folder,

            // 数据库相关命令
            init_database,
            sync_data,

            // WebSocket 相关命令
            create_websocket_connection,
            close_websocket_connection,
            get_websocket_connection_status,
            get_all_websocket_connections_status,
            send_websocket_message,
            subscribe_to_consultation,
            unsubscribe_from_consultation,
            send_read_receipt,
            send_typing_status,

            // 安全相关命令
            encrypt_sensitive_data,
            decrypt_sensitive_data,
            log_audit,
            get_audit_logs,
            detect_anomalies,
            record_failed_login,
            reset_failed_login,
            should_auto_lock,
            get_last_activity,
            get_anomaly_records,
            resolve_anomaly,
            cleanup_old_security_records,

            // AI Person Agent 相关命令
            ai_save_api_key,
            ai_get_api_key_status,
            ai_save_config,
            ai_get_config,
            ai_test_connection,
            ai_chat_stream,
            ai_abort_generation,
            ai_get_or_create_session,
            ai_get_active_messages,
            ai_get_all_messages,
            ai_save_message,
            ai_update_rolling_summary,
            ai_check_or_init_idempotency,
            ai_complete_idempotency,
            ai_fail_idempotency,
            ai_log_tool_audit,
            ai_get_tool_audits,
        ])
        .setup(|app| {
            // 初始化数据库并确保在窗口与命令监听前就绪
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                if let Err(e) = database::init_database(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
