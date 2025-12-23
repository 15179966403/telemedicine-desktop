// 问诊模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consultation {
    pub id: String,
    #[serde(rename = "patientId")]
    pub patient_id: String,
    #[serde(rename = "doctorId")]
    pub doctor_id: String,
    pub status: String,
    #[serde(rename = "consultationType")]
    pub consultation_type: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub diagnosis: Option<String>,
    pub prescription: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}