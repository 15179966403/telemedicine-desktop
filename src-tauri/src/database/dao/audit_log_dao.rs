// 审计日志数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::{BaseDao, PageResult};
use crate::models::AuditLog;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct AuditLogDao {
    connection: DbConnection,
}

impl AuditLogDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn find_by_user_id(&self, user_id: &str, page: i32, page_size: i32) -> Result<PageResult<AuditLog>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let offset = (page - 1) * page_size;

        // 获取总数
        let mut count_stmt = conn.prepare("SELECT COUNT(*) FROM audit_logs WHERE user_id = ?1")?;
        let total: i64 = count_stmt.query_row(params![user_id], |row| row.get(0))?;

        // 获取分页数据
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
             FROM audit_logs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
        )?;

        let log_iter = stmt.query_map(params![user_id, page_size, offset], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                resource_type: row.get(3)?,
                resource_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                ip_address: row.get(6)?,
                user_agent: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }

        Ok(PageResult::new(logs, total, page, page_size))
    }

    pub fn find_by_action(&self, action: &str, page: i32, page_size: i32) -> Result<PageResult<AuditLog>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let offset = (page - 1) * page_size;

        // 获取总数
        let mut count_stmt = conn.prepare("SELECT COUNT(*) FROM audit_logs WHERE action = ?1")?;
        let total: i64 = count_stmt.query_row(params![action], |row| row.get(0))?;

        // 获取分页数据
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
             FROM audit_logs WHERE action = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
        )?;

        let log_iter = stmt.query_map(params![action, page_size, offset], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                resource_type: row.get(3)?,
                resource_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                ip_address: row.get(6)?,
                user_agent: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }

        Ok(PageResult::new(logs, total, page, page_size))
    }

    pub fn find_by_resource(&self, resource_type: &str, resource_id: &str) -> Result<Vec<AuditLog>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
             FROM audit_logs WHERE resource_type = ?1 AND resource_id = ?2 ORDER BY created_at DESC"
        )?;

        let log_iter = stmt.query_map(params![resource_type, resource_id], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                resource_type: row.get(3)?,
                resource_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                ip_address: row.get(6)?,
                user_agent: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }

        Ok(logs)
    }

    pub fn find_recent_logs(&self, limit: i32) -> Result<Vec<AuditLog>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
             FROM audit_logs ORDER BY created_at DESC LIMIT ?1"
        )?;

        let log_iter = stmt.query_map(params![limit], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                resource_type: row.get(3)?,
                resource_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                ip_address: row.get(6)?,
                user_agent: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }

        Ok(logs)
    }

    pub fn cleanup_old_logs(&self, days: i32) -> Result<usize, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let deleted = conn.execute(
            "DELETE FROM audit_logs WHERE created_at < datetime('now', '-' || ?1 || ' days')",
            params![days],
        )?;

        if deleted > 0 {
            println!("Cleaned up {} old audit logs (older than {} days)", deleted, days);
        }

        Ok(deleted)
    }

    pub fn get_action_stats(&self, days: i32) -> Result<Vec<ActionStat>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT action, COUNT(*) as count
             FROM audit_logs
             WHERE created_at >= datetime('now', '-' || ?1 || ' days')
             GROUP BY action
             ORDER BY count DESC"
        )?;

        let stat_iter = stmt.query_map(params![days], |row| {
            Ok(ActionStat {
                action: row.get(0)?,
                count: row.get(1)?,
            })
        })?;

        let mut stats = Vec::new();
        for stat in stat_iter {
            stats.push(stat?);
        }

        Ok(stats)
    }

    pub fn log_action(&self, user_id: &str, action: &str, resource_type: Option<&str>, resource_id: Option<&str>,
                     details: Option<serde_json::Value>, ip_address: Option<&str>, user_agent: Option<&str>) -> Result<String, Box<dyn std::error::Error>> {
        let log = AuditLog {
            id: Uuid::new_v4().to_string(),
            user_id: Some(user_id.to_string()),
            action: action.to_string(),
            resource_type: resource_type.map(|s| s.to_string()),
            resource_id: resource_id.map(|s| s.to_string()),
            details: details.unwrap_or_default(),
            ip_address: ip_address.map(|s| s.to_string()),
            user_agent: user_agent.map(|s| s.to_string()),
            created_at: Utc::now(),
        };

        self.create(&log)
    }
}

#[derive(Debug, Clone)]
pub struct ActionStat {
    pub action: String,
    pub count: i64,
}

impl BaseDao<AuditLog> for AuditLogDao {
    fn create(&self, log: &AuditLog) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let details_json = serde_json::to_string(&log.details)?;

        conn.execute(
            "INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                log.user_id,
                log.action,
                log.resource_type,
                log.resource_id,
                details_json,
                log.ip_address,
                log.user_agent,
                log.created_at
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<AuditLog>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
             FROM audit_logs WHERE id = ?1"
        )?;

        let log_result = stmt.query_row(params![id], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                resource_type: row.get(3)?,
                resource_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                ip_address: row.get(6)?,
                user_agent: row.get(7)?,
                created_at: row.get(8)?,
            })
        });

        match log_result {
            Ok(log) => Ok(Some(log)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, log: &AuditLog) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let details_json = serde_json::to_string(&log.details)?;

        conn.execute(
            "UPDATE audit_logs SET user_id = ?1, action = ?2, resource_type = ?3, resource_id = ?4,
             details = ?5, ip_address = ?6, user_agent = ?7, created_at = ?8 WHERE id = ?9",
            params![
                log.user_id,
                log.action,
                log.resource_type,
                log.resource_id,
                details_json,
                log.ip_address,
                log.user_agent,
                log.created_at,
                log.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM audit_logs WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<AuditLog>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at
             FROM audit_logs ORDER BY created_at DESC"
        )?;

        let log_iter = stmt.query_map([], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                resource_type: row.get(3)?,
                resource_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s|
                    serde_json::from_str(&s).unwrap_or_default()
                ).unwrap_or_default(),
                ip_address: row.get(6)?,
                user_agent: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut logs = Vec::new();
        for log in log_iter {
            logs.push(log?);
        }

        Ok(logs)
    }
}

impl Default for AuditLogDao {
    fn default() -> Self {
        Self::new()
    }
}