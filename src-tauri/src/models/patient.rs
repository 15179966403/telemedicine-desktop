// 患者模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub age: Option<u32>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    #[serde(rename = "idCard")]
    pub id_card: Option<String>,
    pub tags: Vec<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "lastSync")]
    pub last_sync: Option<DateTime<Utc>>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Gender {
    Male,
    Female,
}

impl std::fmt::Display for Gender {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Gender::Male => write!(f, "male"),
            Gender::Female => write!(f, "female"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientQuery {
    pub keyword: Option<String>,
    pub tags: Option<Vec<String>>,
    pub gender: Option<Gender>,
    #[serde(rename = "ageRange")]
    pub age_range: Option<AgeRange>,
    #[serde(rename = "lastVisitRange")]
    pub last_visit_range: Option<DateRange>,
    pub page: u32,
    #[serde(rename = "pageSize")]
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgeRange {
    pub min: u32,
    pub max: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientList {
    pub patients: Vec<Patient>,
    pub total: u32,
    pub page: u32,
    #[serde(rename = "pageSize")]
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientDetail {
    #[serde(flatten)]
    pub patient: Patient,
    #[serde(rename = "consultationHistory")]
    pub consultation_history: Vec<ConsultationSummary>,
    #[serde(rename = "followUpReminders")]
    pub follow_up_reminders: Vec<FollowUpReminder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsultationSummary {
    pub id: String,
    #[serde(rename = "type")]
    pub consultation_type: String,
    pub status: String,
    pub diagnosis: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowUpReminder {
    pub id: String,
    #[serde(rename = "patientId")]
    pub patient_id: String,
    #[serde(rename = "type")]
    pub reminder_type: String,
    pub message: String,
    #[serde(rename = "scheduledAt")]
    pub scheduled_at: DateTime<Utc>,
    pub completed: bool,
}