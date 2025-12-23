// 医疗记录数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::BaseDao;
use crate::models::MedicalRecord;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct MedicalRecordDao {
    connection: DbConnection,
}

impl MedicalRecordDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn find_by_patient_id(&self, patient_id: &str) -> Result<Vec<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records WHERE patient_id = ?1 ORDER BY created_at DESC"
        )?;

        let record_iter = stmt.query_map(params![patient_id], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }

    pub fn find_by_consultation_id(&self, consultation_id: &str) -> Result<Vec<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records WHERE consultation_id = ?1 ORDER BY created_at DESC"
        )?;

        let record_iter = stmt.query_map(params![consultation_id], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }

    pub fn find_by_type(&self, patient_id: &str, record_type: &str) -> Result<Vec<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records WHERE patient_id = ?1 AND record_type = ?2 ORDER BY created_at DESC"
        )?;

        let record_iter = stmt.query_map(params![patient_id, record_type], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }

    pub fn find_by_doctor_id(&self, doctor_id: &str, limit: Option<i32>) -> Result<Vec<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let sql = if let Some(limit) = limit {
            format!(
                "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
                 FROM medical_records WHERE doctor_id = ?1 ORDER BY created_at DESC LIMIT {}",
                limit
            )
        } else {
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records WHERE doctor_id = ?1 ORDER BY created_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&sql)?;
        let record_iter = stmt.query_map(params![doctor_id], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }

    pub fn search_records(&self, patient_id: &str, keyword: &str) -> Result<Vec<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let search_pattern = format!("%{}%", keyword);

        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records WHERE patient_id = ?1 AND (title LIKE ?2 OR content LIKE ?2) ORDER BY created_at DESC"
        )?;

        let record_iter = stmt.query_map(params![patient_id, search_pattern], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }
}

impl BaseDao<MedicalRecord> for MedicalRecordDao {
    fn create(&self, record: &MedicalRecord) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let attachments_json = serde_json::to_string(&record.attachments)?;

        conn.execute(
            "INSERT INTO medical_records (id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id,
                record.patient_id,
                record.doctor_id,
                record.consultation_id,
                record.record_type,
                record.title,
                record.content,
                attachments_json,
                now,
                now
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records WHERE id = ?1"
        )?;

        let record_result = stmt.query_row(params![id], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        });

        match record_result {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, record: &MedicalRecord) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();
        let attachments_json = serde_json::to_string(&record.attachments)?;

        conn.execute(
            "UPDATE medical_records SET patient_id = ?1, doctor_id = ?2, consultation_id = ?3, record_type = ?4,
             title = ?5, content = ?6, attachments = ?7, updated_at = ?8 WHERE id = ?9",
            params![
                record.patient_id,
                record.doctor_id,
                record.consultation_id,
                record.record_type,
                record.title,
                record.content,
                attachments_json,
                now,
                record.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM medical_records WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<MedicalRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, consultation_id, record_type, title, content, attachments, created_at, updated_at
             FROM medical_records ORDER BY created_at DESC"
        )?;

        let record_iter = stmt.query_map([], |row| {
            Ok(MedicalRecord {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                consultation_id: row.get(3)?,
                record_type: row.get(4)?,
                title: row.get(5)?,
                content: row.get(6)?,
                attachments: row.get::<_, Option<String>>(7)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }
}

impl Default for MedicalRecordDao {
    fn default() -> Self {
        Self::new()
    }
}