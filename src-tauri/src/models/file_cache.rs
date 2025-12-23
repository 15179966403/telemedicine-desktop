// 文件缓存模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCache {
    pub id: String,
    #[serde(rename = "fileUrl")]
    pub file_url: String,
    #[serde(rename = "localPath")]
    pub local_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: Option<u64>,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub checksum: Option<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(rename = "downloadedAt")]
    pub downloaded_at: DateTime<Utc>,
    #[serde(rename = "lastAccessed")]
    pub last_accessed: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(rename = "localPath")]
    pub local_path: Option<String>,
    #[serde(rename = "fileType")]
    pub file_type: String,
    pub size: u64,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "uploadedAt")]
    pub uploaded_at: DateTime<Utc>,
}