// 问诊数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::{BaseDao, PageResult};
use crate::models::Consultation;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct ConsultationDao {
    connection: DbConnection,
}

impl ConsultationDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn find_by_patient_id(&self, patient_id: &str) -> Result<Vec<Consultation>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at
             FROM consultations WHERE patient_id = ?1 ORDER BY created_at DESC"
        )?;

        let consultation_iter = stmt.query_map(params![patient_id], |row| {
            Ok(Consultation {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                status: row.get(3)?,
                consultation_type: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                diagnosis: row.get(7)?,
                prescription: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut consultations = Vec::new();
        for consultation in consultation_iter {
            consultations.push(consultation?);
        }

        Ok(consultations)
    }

    pub fn find_by_doctor_id(&self, doctor_id: &str) -> Result<Vec<Consultation>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at
             FROM consultations WHERE doctor_id = ?1 ORDER BY created_at DESC"
        )?;

        let consultation_iter = stmt.query_map(params![doctor_id], |row| {
            Ok(Consultation {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                status: row.get(3)?,
                consultation_type: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                diagnosis: row.get(7)?,
                prescription: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut consultations = Vec::new();
        for consultation in consultation_iter {
            consultations.push(consultation?);
        }

        Ok(consultations)
    }

    pub fn find_by_status(&self, status: &str, page: i32, page_size: i32) -> Result<PageResult<Consultation>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let offset = (page - 1) * page_size;

        // 获取总数
        let mut count_stmt = conn.prepare("SELECT COUNT(*) FROM consultations WHERE status = ?1")?;
        let total: i64 = count_stmt.query_row(params![status], |row| row.get(0))?;

        // 获取分页数据
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at
             FROM consultations WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
        )?;

        let consultation_iter = stmt.query_map(params![status, page_size, offset], |row| {
            Ok(Consultation {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                status: row.get(3)?,
                consultation_type: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                diagnosis: row.get(7)?,
                prescription: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut consultations = Vec::new();
        for consultation in consultation_iter {
            consultations.push(consultation?);
        }

        Ok(PageResult::new(consultations, total, page, page_size))
    }

    pub fn update_status(&self, consultation_id: &str, status: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE consultations SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status, now, consultation_id],
        )?;

        Ok(())
    }

    pub fn update_diagnosis(&self, consultation_id: &str, diagnosis: &str, prescription: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE consultations SET diagnosis = ?1, prescription = ?2, updated_at = ?3 WHERE id = ?4",
            params![diagnosis, prescription, now, consultation_id],
        )?;

        Ok(())
    }

    pub fn get_active_consultations(&self, doctor_id: &str) -> Result<Vec<Consultation>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at
             FROM consultations WHERE doctor_id = ?1 AND status IN ('pending', 'active') ORDER BY created_at ASC"
        )?;

        let consultation_iter = stmt.query_map(params![doctor_id], |row| {
            Ok(Consultation {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                status: row.get(3)?,
                consultation_type: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                diagnosis: row.get(7)?,
                prescription: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut consultations = Vec::new();
        for consultation in consultation_iter {
            consultations.push(consultation?);
        }

        Ok(consultations)
    }

    pub fn get_consultation_stats(&self, doctor_id: &str) -> Result<ConsultationStats, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut pending_stmt = conn.prepare("SELECT COUNT(*) FROM consultations WHERE doctor_id = ?1 AND status = 'pending'")?;
        let pending_count: i64 = pending_stmt.query_row(params![doctor_id], |row| row.get(0))?;

        let mut active_stmt = conn.prepare("SELECT COUNT(*) FROM consultations WHERE doctor_id = ?1 AND status = 'active'")?;
        let active_count: i64 = active_stmt.query_row(params![doctor_id], |row| row.get(0))?;

        let mut completed_stmt = conn.prepare("SELECT COUNT(*) FROM consultations WHERE doctor_id = ?1 AND status = 'completed'")?;
        let completed_count: i64 = completed_stmt.query_row(params![doctor_id], |row| row.get(0))?;

        Ok(ConsultationStats {
            pending: pending_count,
            active: active_count,
            completed: completed_count,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ConsultationStats {
    pub pending: i64,
    pub active: i64,
    pub completed: i64,
}

impl BaseDao<Consultation> for ConsultationDao {
    fn create(&self, consultation: &Consultation) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        conn.execute(
            "INSERT INTO consultations (id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                consultation.patient_id,
                consultation.doctor_id,
                consultation.status,
                consultation.consultation_type,
                consultation.title,
                consultation.description,
                consultation.diagnosis,
                consultation.prescription,
                now,
                now
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<Consultation>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at
             FROM consultations WHERE id = ?1"
        )?;

        let consultation_result = stmt.query_row(params![id], |row| {
            Ok(Consultation {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                status: row.get(3)?,
                consultation_type: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                diagnosis: row.get(7)?,
                prescription: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        });

        match consultation_result {
            Ok(consultation) => Ok(Some(consultation)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, consultation: &Consultation) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE consultations SET patient_id = ?1, doctor_id = ?2, status = ?3, consultation_type = ?4,
             title = ?5, description = ?6, diagnosis = ?7, prescription = ?8, updated_at = ?9 WHERE id = ?10",
            params![
                consultation.patient_id,
                consultation.doctor_id,
                consultation.status,
                consultation.consultation_type,
                consultation.title,
                consultation.description,
                consultation.diagnosis,
                consultation.prescription,
                now,
                consultation.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM consultations WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<Consultation>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, doctor_id, status, consultation_type, title, description, diagnosis, prescription, created_at, updated_at
             FROM consultations ORDER BY created_at DESC"
        )?;

        let consultation_iter = stmt.query_map([], |row| {
            Ok(Consultation {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                doctor_id: row.get(2)?,
                status: row.get(3)?,
                consultation_type: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                diagnosis: row.get(7)?,
                prescription: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut consultations = Vec::new();
        for consultation in consultation_iter {
            consultations.push(consultation?);
        }

        Ok(consultations)
    }
}

impl Default for ConsultationDao {
    fn default() -> Self {
        Self::new()
    }
}