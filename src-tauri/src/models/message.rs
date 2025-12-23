// 消息模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    #[serde(rename = "consultationId")]
    pub consultation_id: String,
    #[serde(rename = "type")]
    pub message_type: MessageType,
    pub content: String,
    pub sender: MessageSender,
    pub timestamp: DateTime<Utc>,
    pub status: MessageStatus,
    #[serde(rename = "fileInfo")]
    pub file_info: Option<FileInfo>,
    #[serde(rename = "replyTo")]
    pub reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Text,
    Image,
    Voice,
    File,
    Template,
}

impl std::fmt::Display for MessageType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageType::Text => write!(f, "text"),
            MessageType::Image => write!(f, "image"),
            MessageType::Voice => write!(f, "voice"),
            MessageType::File => write!(f, "file"),
            MessageType::Template => write!(f, "template"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSender {
    Doctor,
    Patient,
}

impl std::fmt::Display for MessageSender {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageSender::Doctor => write!(f, "doctor"),
            MessageSender::Patient => write!(f, "patient"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    Sending,
    Sent,
    Delivered,
    Read,
    Failed,
}

impl std::fmt::Display for MessageStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageStatus::Sending => write!(f, "sending"),
            MessageStatus::Sent => write!(f, "sent"),
            MessageStatus::Delivered => write!(f, "delivered"),
            MessageStatus::Read => write!(f, "read"),
            MessageStatus::Failed => write!(f, "failed"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    #[serde(rename = "type")]
    pub file_type: String,
    pub url: String,
    #[serde(rename = "localPath")]
    pub local_path: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageList {
    pub messages: Vec<Message>,
    pub total: u32,
    pub page: u32,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consultation {
    pub id: String,
    #[serde(rename = "patientId")]
    pub patient_id: String,
    #[serde(rename = "patientName")]
    pub patient_name: String,
    #[serde(rename = "patientAvatar")]
    pub patient_avatar: Option<String>,
    #[serde(rename = "doctorId")]
    pub doctor_id: String,
    #[serde(rename = "type")]
    pub consultation_type: ConsultationType,
    pub status: ConsultationStatus,
    pub title: String,
    pub description: String,
    pub symptoms: Vec<String>,
    pub attachments: Vec<FileInfo>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(rename = "lastMessage")]
    pub last_message: Option<Message>,
    #[serde(rename = "unreadCount")]
    pub unread_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConsultationType {
    Text,
    Video,
    Phone,
}

impl std::fmt::Display for ConsultationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConsultationType::Text => write!(f, "text"),
            ConsultationType::Video => write!(f, "video"),
            ConsultationType::Phone => write!(f, "phone"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConsultationStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
    Expired,
}

impl std::fmt::Display for ConsultationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConsultationStatus::Pending => write!(f, "pending"),
            ConsultationStatus::Active => write!(f, "active"),
            ConsultationStatus::Completed => write!(f, "completed"),
            ConsultationStatus::Cancelled => write!(f, "cancelled"),
            ConsultationStatus::Expired => write!(f, "expired"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalTemplate {
    pub id: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    #[serde(rename = "usageCount")]
    pub usage_count: u32,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    #[serde(rename = "consultationId")]
    pub consultation_id: String,
    #[serde(rename = "type")]
    pub message_type: MessageType,
    pub content: String,
    #[serde(rename = "fileId")]
    pub file_id: Option<String>,
    #[serde(rename = "replyTo")]
    pub reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageQueueItem {
    pub id: String,
    pub message: SendMessageRequest,
    #[serde(rename = "retryCount")]
    pub retry_count: u32,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncStatus {
    Pending,
    Syncing,
    Synced,
    Failed,
    Conflict,
}

impl std::fmt::Display for SyncStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncStatus::Pending => write!(f, "pending"),
            SyncStatus::Syncing => write!(f, "syncing"),
            SyncStatus::Synced => write!(f, "synced"),
            SyncStatus::Failed => write!(f, "failed"),
            SyncStatus::Conflict => write!(f, "conflict"),
        }
    }
}