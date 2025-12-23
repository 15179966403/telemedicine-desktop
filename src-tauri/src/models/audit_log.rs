// 审计日志模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    pub action: String,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceId")]
    pub resource_id: Option<String>,
    pub details: serde_json::Value,
    #[serde(rename = "ipAddress")]
    pub ip_address: Option<String>,
    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogQuery {
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    pub action: Option<String>,
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceId")]
    pub resource_id: Option<String>,
    #[serde(rename = "dateRange")]
    pub date_range: Option<DateRange>,
    pub page: u32,
    #[serde(rename = "pageSize")]
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}