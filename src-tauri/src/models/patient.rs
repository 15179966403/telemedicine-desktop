// 患者模型

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub age: u32,
    pub gender: Gender,
    pub phone: String,
    pub tags: Vec<String>,
    pub last_visit: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Serialize, Deserialize)]
pub struct MedicalRecord {
    pub id: String,
    pub patient_id: String,
    pub doctor_id: String,
    pub diagnosis: String,
    pub treatment: String,
    pub notes: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}