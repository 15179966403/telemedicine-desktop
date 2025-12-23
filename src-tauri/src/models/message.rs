// 消息模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    #[serde(rename = "consultationId")]
    pub consultation_id: String,
    #[serde(rename = "senderType")]
    pub sender_type: String,
    #[serde(rename = "messageType")]
    pub message_type: String,
    pub content: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    #[serde(rename = "fileSize")]
    pub file_size: Option<u64>,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "syncStatus")]
    pub sync_status: String,
    #[serde(rename = "readStatus")]
    pub read_status: String,
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