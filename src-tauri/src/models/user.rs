// 用户模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub avatar: Option<String>,
    pub department: String,
    pub title: String,
    pub license_number: String,
    pub audit_status: AuditStatus,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuditStatus {
    Pending,
    Approved,
    Rejected,
    Incomplete,
}

impl std::fmt::Display for AuditStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditStatus::Pending => write!(f, "pending"),
            AuditStatus::Approved => write!(f, "approved"),
            AuditStatus::Rejected => write!(f, "rejected"),
            AuditStatus::Incomplete => write!(f, "incomplete"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginCredentials {
    #[serde(rename = "type")]
    pub login_type: LoginType,
    pub username: Option<String>,
    pub password: Option<String>,
    pub phone: Option<String>,
    #[serde(rename = "smsCode")]
    pub sms_code: Option<String>,
    #[serde(rename = "idCard")]
    pub id_card: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoginType {
    Password,
    Sms,
    Realname,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub success: bool,
    pub token: Option<String>,
    pub user: Option<User>,
    pub message: Option<String>,
    #[serde(rename = "requiresRealname")]
    pub requires_realname: Option<bool>,
    #[serde(rename = "auditStatus")]
    pub audit_status: Option<AuditStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: DateTime<Utc>,
    #[serde(rename = "userId")]
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthSession {
    pub user_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}