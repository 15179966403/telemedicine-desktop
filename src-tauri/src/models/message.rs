// 消息模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// 消息类型枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "image")]
    Image,
    #[serde(rename = "voice")]
    Voice,
    #[serde(rename = "file")]
    File,
    #[serde(rename = "template")]
    Template,
}

// 发送者类型枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SenderType {
    #[serde(rename = "doctor")]
    Doctor,
    #[serde(rename = "patient")]
    Patient,
}

// 同步状态枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "synced")]
    Synced,
    #[serde(rename = "failed")]
    Failed,
}

// 已读状态枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReadStatus {
    #[serde(rename = "unread")]
    Unread,
    #[serde(rename = "read")]
    Read,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    #[serde(rename = "consultationId")]
    pub consultation_id: String,
    #[serde(rename = "senderType")]
    pub sender_type: SenderType,
    #[serde(rename = "messageType")]
    pub message_type: MessageType,
    pub content: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    #[serde(rename = "fileSize")]
    pub file_size: Option<u64>,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "syncStatus")]
    pub sync_status: SyncStatus,
    #[serde(rename = "readStatus")]
    pub read_status: ReadStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    #[serde(rename = "consultationId")]
    pub consultation_id: String,
    #[serde(rename = "messageType")]
    pub message_type: String,
    pub content: String,
    #[serde(rename = "fileId")]
    pub file_id: Option<String>,
}