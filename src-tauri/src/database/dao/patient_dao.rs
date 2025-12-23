// 患者数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::{BaseDao, QueryBuilder, PageResult};
use crate::models::Patient;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct PatientDao {
    connection: DbConnection,
}

impl PatientDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn search_patients(&self, keyword: &str, page: i32, page_size: i32) -> Result<PageResult<Patient>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let offset = (page - 1) * page_size;

        // 构建搜索条件
        let search_condition = format!(
            "WHERE name LIKE '%{}%' OR phone LIKE '%{}%' OR id_card LIKE '%{}%'",
            keyword, keyword, keyword
        );

        // 获取总数
        let count_sql = format!("SELECT COUNT(*) FROM patients {}", search_condition);
        let mut count_stmt = conn.prepare(&count_sql)?;
        let total: i64 = count_stmt.query_row([], |row| row.get(0))?;

        // 获取分页数据
        let query_sql = format!(
            "SELECT id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at
             FROM patients {} ORDER BY created_at DESC LIMIT {} OFFSET {}",
            search_condition, page_size, offset
        );

        let mut stmt = conn.prepare(&query_sql)?;
        let patient_iter = stmt.query_map([], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                gender: row.get(3)?,
                phone: row.get(4)?,
                id_card: row.get(5)?,
                tags: row.get::<_, Option<String>>(6)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                avatar_url: row.get(7)?,
                last_sync: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut patients = Vec::new();
        for patient in patient_iter {
            patients.push(patient?);
        }

        Ok(PageResult::new(patients, total, page, page_size))
    }

    pub fn find_by_phone(&self, phone: &str) -> Result<Option<Patient>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at
             FROM patients WHERE phone = ?1"
        )?;

        let patient_result = stmt.query_row(params![phone], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                gender: row.get(3)?,
                phone: row.get(4)?,
                id_card: row.get(5)?,
                tags: row.get::<_, Option<String>>(6)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                avatar_url: row.get(7)?,
                last_sync: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        });

        match patient_result {
            Ok(patient) => Ok(Some(patient)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub fn find_by_tags(&self, tags: &[String]) -> Result<Vec<Patient>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // 构建标签查询条件
        let tag_conditions: Vec<String> = tags.iter()
            .map(|tag| format!("tags LIKE '%\"{}%'", tag))
            .collect();
        let where_clause = format!("WHERE {}", tag_conditions.join(" OR "));

        let query_sql = format!(
            "SELECT id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at
             FROM patients {} ORDER BY created_at DESC",
            where_clause
        );

        let mut stmt = conn.prepare(&query_sql)?;
        let patient_iter = stmt.query_map([], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                gender: row.get(3)?,
                phone: row.get(4)?,
                id_card: row.get(5)?,
                tags: row.get::<_, Option<String>>(6)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                avatar_url: row.get(7)?,
                last_sync: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut patients = Vec::new();
        for patient in patient_iter {
            patients.push(patient?);
        }

        Ok(patients)
    }

    pub fn update_tags(&self, patient_id: &str, tags: &[String]) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let tags_json = serde_json::to_string(tags)?;
        let now = Utc::now();

        conn.execute(
            "UPDATE patients SET tags = ?1, updated_at = ?2 WHERE id = ?3",
            params![tags_json, now, patient_id],
        )?;

        Ok(())
    }

    pub fn update_last_sync(&self, patient_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE patients SET last_sync = ?1, updated_at = ?2 WHERE id = ?3",
            params![now, now, patient_id],
        )?;

        Ok(())
    }

    pub fn get_recent_patients(&self, limit: i32) -> Result<Vec<Patient>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at
             FROM patients ORDER BY updated_at DESC LIMIT ?1"
        )?;

        let patient_iter = stmt.query_map(params![limit], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                gender: row.get(3)?,
                phone: row.get(4)?,
                id_card: row.get(5)?,
                tags: row.get::<_, Option<String>>(6)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                avatar_url: row.get(7)?,
                last_sync: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut patients = Vec::new();
        for patient in patient_iter {
            patients.push(patient?);
        }

        Ok(patients)
    }
}

impl BaseDao<Patient> for PatientDao {
    fn create(&self, patient: &Patient) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let tags_json = serde_json::to_string(&patient.tags)?;

        conn.execute(
            "INSERT INTO patients (id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                patient.name,
                patient.age,
                patient.gender,
                patient.phone,
                patient.id_card,
                tags_json,
                patient.avatar_url,
                patient.last_sync,
                now,
                now
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<Patient>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at
             FROM patients WHERE id = ?1"
        )?;

        let patient_result = stmt.query_row(params![id], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                gender: row.get(3)?,
                phone: row.get(4)?,
                id_card: row.get(5)?,
                tags: row.get::<_, Option<String>>(6)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                avatar_url: row.get(7)?,
                last_sync: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        });

        match patient_result {
            Ok(patient) => Ok(Some(patient)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, patient: &Patient) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();
        let tags_json = serde_json::to_string(&patient.tags)?;

        conn.execute(
            "UPDATE patients SET name = ?1, age = ?2, gender = ?3, phone = ?4, id_card = ?5, tags = ?6,
             avatar_url = ?7, last_sync = ?8, updated_at = ?9 WHERE id = ?10",
            params![
                patient.name,
                patient.age,
                patient.gender,
                patient.phone,
                patient.id_card,
                tags_json,
                patient.avatar_url,
                patient.last_sync,
                now,
                patient.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM patients WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<Patient>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, age, gender, phone, id_card, tags, avatar_url, last_sync, created_at, updated_at
             FROM patients ORDER BY created_at DESC"
        )?;

        let patient_iter = stmt.query_map([], |row| {
            Ok(Patient {
                id: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                gender: row.get(3)?,
                phone: row.get(4)?,
                id_card: row.get(5)?,
                tags: row.get::<_, Option<String>>(6)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                avatar_url: row.get(7)?,
                last_sync: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut patients = Vec::new();
        for patient in patient_iter {
            patients.push(patient?);
        }

        Ok(patients)
    }
}

impl Default for PatientDao {
    fn default() -> Self {
        Self::new()
    }
}