// 问诊模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// Note: Main Consultation struct is now in message.rs to avoid circular dependencies
// This file contains additional consultation-related types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsultationOrder {
    pub id: String,
    #[serde(rename = "patientId")]
    pub patient_id: String,
    #[serde(rename = "doctorId")]
    pub doctor_id: String,
    pub status: OrderStatus,
    #[serde(rename = "consultationType")]
    pub consultation_type: String,
    pub title: String,
    pub description: String,
    pub symptoms: Vec<String>,
    pub attachments: Vec<String>, // file URLs
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderStatus {
    Pending,
    Accepted,
    InProgress,
    Completed,
    Cancelled,
    Expired,
}

impl std::fmt::Display for OrderStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderStatus::Pending => write!(f, "pending"),
            OrderStatus::Accepted => write!(f, "accepted"),
            OrderStatus::InProgress => write!(f, "in_progress"),
            OrderStatus::Completed => write!(f, "completed"),
            OrderStatus::Cancelled => write!(f, "cancelled"),
            OrderStatus::Expired => write!(f, "expired"),
        }
    }
}