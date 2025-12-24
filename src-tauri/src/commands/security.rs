// 安全相关命令

use crate::services::security::{AuditAction, AuditLog, AnomalyRecord, SecurityService};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub type SecurityServiceState = Arc<Mutex<SecurityService>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct LogAuditRequest {
    pub user_id: String,
    pub action: String,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetAuditLogsRequest {
    pub user_id: Option<String>,
    pub action: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub limit: usize,
}

/// 加密敏感数据
#[tauri::command]
pub async fn encrypt_sensitive_data(
    data: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<String, String> {
    let service = security_service.lock().await;
    service
        .encrypt_sensitive_data(&data)
        .map_err(|e| e.to_string())
}

/// 解密敏感数据
#[tauri::command]
pub async fn decrypt_sensitive_data(
    encrypted_data: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<String, String> {
    let service = security_service.lock().await;
    service
        .decrypt_sensitive_data(&encrypted_data)
        .map_err(|e| e.to_string())
}

/// 记录操作日志
#[tauri::command]
pub async fn log_audit(
    request: LogAuditRequest,
    security_service: State<'_, SecurityServiceState>,
) -> Result<String, String> {
    let service = security_service.lock().await;

    let action = parse_audit_action(&request.action)?;

    service
        .log_audit(
            request.user_id,
            action,
            request.resource_type,
            request.resource_id,
            request.status,
            request.error_message,
            request.metadata,
        )
        .await
        .map_err(|e| e.to_string())
}

/// 获取操作日志
#[tauri::command]
pub async fn get_audit_logs(
    request: GetAuditLogsRequest,
    security_service: State<'_, SecurityServiceState>,
) -> Result<Vec<AuditLog>, String> {
    let service = security_service.lock().await;

    let action = if let Some(ref action_str) = request.action {
        Some(parse_audit_action(action_str)?)
    } else {
        None
    };

    let start_time = if let Some(ref time_str) = request.start_time {
        Some(parse_datetime(time_str)?)
    } else {
        None
    };

    let end_time = if let Some(ref time_str) = request.end_time {
        Some(parse_datetime(time_str)?)
    } else {
        None
    };

    service
        .get_audit_logs(request.user_id, action, start_time, end_time, request.limit)
        .await
        .map_err(|e| e.to_string())
}

/// 检测异常访问
#[tauri::command]
pub async fn detect_anomalies(
    user_id: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<Vec<AnomalyRecord>, String> {
    let service = security_service.lock().await;
    service
        .detect_anomalies(&user_id)
        .await
        .map_err(|e| e.to_string())
}

/// 记录登录失败
#[tauri::command]
pub async fn record_failed_login(
    user_id: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<(), String> {
    let service = security_service.lock().await;
    service.record_failed_login(&user_id).await;
    Ok(())
}

/// 重置登录失败计数
#[tauri::command]
pub async fn reset_failed_login(
    user_id: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<(), String> {
    let service = security_service.lock().await;
    service.reset_failed_login(&user_id).await;
    Ok(())
}

/// 检查是否需要自动锁屏
#[tauri::command]
pub async fn should_auto_lock(
    user_id: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<bool, String> {
    let service = security_service.lock().await;
    Ok(service.should_auto_lock(&user_id).await)
}

/// 获取最后活动时间
#[tauri::command]
pub async fn get_last_activity(
    user_id: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<Option<String>, String> {
    let service = security_service.lock().await;
    Ok(service
        .get_last_activity(&user_id)
        .await
        .map(|dt| dt.to_rfc3339()))
}

/// 获取异常记录
#[tauri::command]
pub async fn get_anomaly_records(
    user_id: Option<String>,
    resolved: Option<bool>,
    security_service: State<'_, SecurityServiceState>,
) -> Result<Vec<AnomalyRecord>, String> {
    let service = security_service.lock().await;
    service
        .get_anomaly_records(user_id, resolved)
        .await
        .map_err(|e| e.to_string())
}

/// 标记异常已解决
#[tauri::command]
pub async fn resolve_anomaly(
    anomaly_id: String,
    security_service: State<'_, SecurityServiceState>,
) -> Result<(), String> {
    let service = security_service.lock().await;
    service
        .resolve_anomaly(&anomaly_id)
        .await
        .map_err(|e| e.to_string())
}

/// 清理旧的日志和记录
#[tauri::command]
pub async fn cleanup_old_security_records(
    days: i64,
    security_service: State<'_, SecurityServiceState>,
) -> Result<(), String> {
    let service = security_service.lock().await;
    service
        .cleanup_old_records(days)
        .await
        .map_err(|e| e.to_string())
}

// 辅助函数
fn parse_audit_action(action_str: &str) -> Result<AuditAction, String> {
    match action_str.to_lowercase().as_str() {
        "login" => Ok(AuditAction::Login),
        "logout" => Ok(AuditAction::Logout),
        "view_patient" => Ok(AuditAction::ViewPatient),
        "update_patient" => Ok(AuditAction::UpdatePatient),
        "send_message" => Ok(AuditAction::SendMessage),
        "upload_file" => Ok(AuditAction::UploadFile),
        "download_file" => Ok(AuditAction::DownloadFile),
        "access_sensitive_data" => Ok(AuditAction::AccessSensitiveData),
        "change_settings" => Ok(AuditAction::ChangeSettings),
        "delete_data" => Ok(AuditAction::DeleteData),
        _ => Err(format!("Unknown audit action: {}", action_str)),
    }
}

fn parse_datetime(datetime_str: &str) -> Result<DateTime<Utc>, String> {
    DateTime::parse_from_rfc3339(datetime_str)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| format!("Invalid datetime format: {}", e))
}
