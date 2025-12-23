// 问诊模型

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consultation {
    pub id: String,
    pub patient_id: String,
    pub doctor_id: String,
    pub status: ConsultationStatus,
    pub consultation_type: ConsultationType,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsultationStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
}

impl std::fmt::Display for ConsultationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConsultationStatus::Pending => write!(f, "pending"),
            ConsultationStatus::Active => write!(f, "active"),
            ConsultationStatus::Completed => write!(f, "completed"),
            ConsultationStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsultationType {
    Text,
    Video,
    Voice,
}

impl std::fmt::Display for ConsultationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConsultationType::Text => write!(f, "text"),
            ConsultationType::Video => write!(f, "video"),
            ConsultationType::Voice => write!(f, "voice"),
        }
    }
}