// 医疗记录模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalRecord {
    pub id: String,
    #[serde(rename = "patientId")]
    pub patient_id: String,
    #[serde(rename = "doctorId")]
    pub doctor_id: String,
    #[serde(rename = "consultationId")]
    pub consultation_id: Option<String>,
    #[serde(rename = "recordType")]
    pub record_type: String,
    pub title: String,
    pub content: Option<String>,
    pub attachments: Vec<Attachment>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(rename = "fileType")]
    pub file_type: String,
    pub size: u64,
    #[serde(rename = "uploadedAt")]
    pub uploaded_at: DateTime<Utc>,
}