// 消息模型

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub consultation_id: String,
    pub sender_type: SenderType,
    pub message_type: MessageType,
    pub content: String,
    pub file_path: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub sync_status: SyncStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SenderType {
    Doctor,
    Patient,
}

impl std::fmt::Display for SenderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SenderType::Doctor => write!(f, "doctor"),
            SenderType::Patient => write!(f, "patient"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Text,
    Image,
    Voice,
    File,
}

impl std::fmt::Display for MessageType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageType::Text => write!(f, "text"),
            MessageType::Image => write!(f, "image"),
            MessageType::Voice => write!(f, "voice"),
            MessageType::File => write!(f, "file"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStatus {
    Pending,
    Synced,
    Failed,
}

impl std::fmt::Display for SyncStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncStatus::Pending => write!(f, "pending"),
            SyncStatus::Synced => write!(f, "synced"),
            SyncStatus::Failed => write!(f, "failed"),
        }
    }
}