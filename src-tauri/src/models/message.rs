// 消息模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};

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

impl FromSql for MessageType {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value.as_str()? {
            "text" => Ok(MessageType::Text),
            "image" => Ok(MessageType::Image),
            "voice" => Ok(MessageType::Voice),
            "file" => Ok(MessageType::File),
            "template" => Ok(MessageType::Template),
            _ => Err(FromSqlError::InvalidType),
        }
    }
}

impl ToSql for MessageType {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        let s = match self {
            MessageType::Text => "text",
            MessageType::Image => "image",
            MessageType::Voice => "voice",
            MessageType::File => "file",
            MessageType::Template => "template",
        };
        Ok(ToSqlOutput::from(s))
    }
}

// 发送者类型枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SenderType {
    #[serde(rename = "doctor")]
    Doctor,
    #[serde(rename = "patient")]
    Patient,
}

impl FromSql for SenderType {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value.as_str()? {
            "doctor" => Ok(SenderType::Doctor),
            "patient" => Ok(SenderType::Patient),
            _ => Err(FromSqlError::InvalidType),
        }
    }
}

impl ToSql for SenderType {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        let s = match self {
            SenderType::Doctor => "doctor",
            SenderType::Patient => "patient",
        };
        Ok(ToSqlOutput::from(s))
    }
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

impl FromSql for SyncStatus {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value.as_str()? {
            "pending" => Ok(SyncStatus::Pending),
            "synced" => Ok(SyncStatus::Synced),
            "failed" => Ok(SyncStatus::Failed),
            _ => Err(FromSqlError::InvalidType),
        }
    }
}

impl ToSql for SyncStatus {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        let s = match self {
            SyncStatus::Pending => "pending",
            SyncStatus::Synced => "synced",
            SyncStatus::Failed => "failed",
        };
        Ok(ToSqlOutput::from(s))
    }
}

// 已读状态枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReadStatus {
    #[serde(rename = "unread")]
    Unread,
    #[serde(rename = "read")]
    Read,
}

impl FromSql for ReadStatus {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value.as_str()? {
            "unread" => Ok(ReadStatus::Unread),
            "read" => Ok(ReadStatus::Read),
            _ => Err(FromSqlError::InvalidType),
        }
    }
}

impl ToSql for ReadStatus {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        let s = match self {
            ReadStatus::Unread => "unread",
            ReadStatus::Read => "read",
        };
        Ok(ToSqlOutput::from(s))
    }
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