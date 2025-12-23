// 通用数据模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
    pub code: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: u32,
    #[serde(rename = "pageSize")]
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: u32,
    pub page: u32,
    #[serde(rename = "pageSize")]
    pub page_size: u32,
    #[serde(rename = "totalPages")]
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    #[serde(rename = "type")]
    pub error_type: ErrorType,
    pub message: String,
    pub code: Option<String>,
    pub details: Option<serde_json::Value>,
    pub retryable: Option<bool>,
    #[serde(rename = "retryCount")]
    pub retry_count: Option<u32>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorType {
    NetworkError,
    AuthError,
    ValidationError,
    PermissionError,
    DataError,
    SystemError,
    UnknownError,
}

impl std::fmt::Display for ErrorType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorType::NetworkError => write!(f, "NETWORK_ERROR"),
            ErrorType::AuthError => write!(f, "AUTH_ERROR"),
            ErrorType::ValidationError => write!(f, "VALIDATION_ERROR"),
            ErrorType::PermissionError => write!(f, "PERMISSION_ERROR"),
            ErrorType::DataError => write!(f, "DATA_ERROR"),
            ErrorType::SystemError => write!(f, "SYSTEM_ERROR"),
            ErrorType::UnknownError => write!(f, "UNKNOWN_ERROR"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    #[serde(rename = "type")]
    pub error_type: ErrorType,
    pub message: String,
    pub field: Option<String>,
    pub violations: Vec<ValidationViolation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationViolation {
    pub field: String,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadProgress {
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub loaded: u64,
    pub total: u64,
    pub percentage: f32,
    pub status: UploadStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UploadStatus {
    Uploading,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheItem<T> {
    pub key: String,
    pub data: T,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<DateTime<Utc>>,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(rename = "apiBaseUrl")]
    pub api_base_url: String,
    #[serde(rename = "wsUrl")]
    pub ws_url: String,
    #[serde(rename = "maxFileSize")]
    pub max_file_size: u64, // bytes
    #[serde(rename = "allowedFileTypes")]
    pub allowed_file_types: Vec<String>,
    #[serde(rename = "cacheExpiration")]
    pub cache_expiration: u64, // milliseconds
    #[serde(rename = "retryAttempts")]
    pub retry_attempts: u32,
    #[serde(rename = "retryDelay")]
    pub retry_delay: u64, // milliseconds
    #[serde(rename = "windowLimits")]
    pub window_limits: WindowLimitsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowLimitsConfig {
    #[serde(rename = "maxWindows")]
    pub max_windows: u32,
    #[serde(rename = "maxConsultationWindows")]
    pub max_consultation_windows: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub level: LogLevel,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub context: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NotificationType {
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    #[serde(rename = "type")]
    pub notification_type: NotificationType,
    pub title: String,
    pub message: String,
    pub duration: Option<u32>,
    pub actions: Option<Vec<NotificationAction>>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub label: String,
    pub action: String, // action identifier
    pub primary: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValuePair<T> {
    pub key: String,
    pub value: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectOption<T> {
    pub label: String,
    pub value: T,
    pub disabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortParams {
    pub field: String,
    pub order: SortOrder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchParams {
    pub keyword: String,
    pub fields: Option<Vec<String>>,
    pub exact: Option<bool>,
}