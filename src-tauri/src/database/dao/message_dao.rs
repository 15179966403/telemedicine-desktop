// 消息数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::{BaseDao, PageResult};
use crate::models::Message;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct MessageDao {
    connection: DbConnection,
}

impl MessageDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn find_by_consultation_id(&self, consultation_id: &str, page: i32, page_size: i32) -> Result<PageResult<Message>, String> {
        let conn = self.connection.lock().unwrap();
        let offset = (page - 1) * page_size;

        // 获取总数
        let mut count_stmt = conn.prepare("SELECT COUNT(*) FROM messages WHERE consultation_id = ?1")
            .map_err(|e| e.to_string())?;
        let total: i64 = count_stmt.query_row(params![consultation_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // 获取分页数据，按时间倒序排列（最新的在前面）
        let mut stmt = conn.prepare(
            "SELECT id, consultation_id, sender_type, message_type, content, file_path, file_size, mime_type, timestamp, sync_status, read_status
             FROM messages WHERE consultation_id = ?1 ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3"
        ).map_err(|e| e.to_string())?;

        let message_iter = stmt.query_map(params![consultation_id, page_size, offset], |row| {
            Ok(Message {
                id: row.get(0)?,
                consultation_id: row.get(1)?,
                sender_type: row.get(2)?,
                message_type: row.get(3)?,
                content: row.get(4)?,
                file_path: row.get(5)?,
                file_size: row.get(6)?,
                mime_type: row.get(7)?,
                timestamp: row.get(8)?,
                sync_status: row.get(9)?,
                read_status: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message.map_err(|e| e.to_string())?);
        }

        Ok(PageResult::new(messages, total, page, page_size))
    }

    pub fn find_unsynced_messages(&self) -> Result<Vec<Message>, String> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, consultation_id, sender_type, message_type, content, file_path, file_size, mime_type, timestamp, sync_status, read_status
             FROM messages WHERE sync_status = 'pending' ORDER BY timestamp ASC"
        ).map_err(|e| e.to_string())?;

        let message_iter = stmt.query_map([], |row| {
            Ok(Message {
                id: row.get(0)?,
                consultation_id: row.get(1)?,
                sender_type: row.get(2)?,
                message_type: row.get(3)?,
                content: row.get(4)?,
                file_path: row.get(5)?,
                file_size: row.get(6)?,
                mime_type: row.get(7)?,
                timestamp: row.get(8)?,
                sync_status: row.get(9)?,
                read_status: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message.map_err(|e| e.to_string())?);
        }

        Ok(messages)
    }

    pub fn update_sync_status(&self, message_id: &str, status: &str) -> Result<(), String> {
        let conn = self.connection.lock().unwrap();

        conn.execute(
            "UPDATE messages SET sync_status = ?1 WHERE id = ?2",
            params![status, message_id],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn update_read_status(&self, message_id: &str, status: &str) -> Result<(), String> {
        let conn = self.connection.lock().unwrap();

        conn.execute(
            "UPDATE messages SET read_status = ?1 WHERE id = ?2",
            params![status, message_id],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn mark_consultation_messages_as_read(&self, consultation_id: &str, sender_type: &str) -> Result<usize, String> {
        let conn = self.connection.lock().unwrap();

        let updated = conn.execute(
            "UPDATE messages SET read_status = 'read' WHERE consultation_id = ?1 AND sender_type != ?2 AND read_status = 'unread'",
            params![consultation_id, sender_type],
        ).map_err(|e| e.to_string())?;

        Ok(updated)
    }

    pub fn get_unread_count(&self, consultation_id: &str, sender_type: &str) -> Result<i64, String> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT COUNT(*) FROM messages WHERE consultation_id = ?1 AND sender_type != ?2 AND read_status = 'unread'"
        ).map_err(|e| e.to_string())?;

        let count: i64 = stmt.query_row(params![consultation_id, sender_type], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        Ok(count)
    }

    pub fn get_latest_message(&self, consultation_id: &str) -> Result<Option<Message>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, consultation_id, sender_type, message_type, content, file_path, file_size, mime_type, timestamp, sync_status, read_status
             FROM messages WHERE consultation_id = ?1 ORDER BY timestamp DESC LIMIT 1"
        )?;

        let message_result = stmt.query_row(params![consultation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                consultation_id: row.get(1)?,
                sender_type: row.get(2)?,
                message_type: row.get(3)?,
                content: row.get(4)?,
                file_path: row.get(5)?,
                file_size: row.get(6)?,
                mime_type: row.get(7)?,
                timestamp: row.get(8)?,
                sync_status: row.get(9)?,
                read_status: row.get(10)?,
            })
        });

        match message_result {
            Ok(message) => Ok(Some(message)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub fn delete_old_messages(&self, days: i32) -> Result<usize, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let deleted = conn.execute(
            "DELETE FROM messages WHERE timestamp < datetime('now', '-' || ?1 || ' days')",
            params![days],
        )?;

        if deleted > 0 {
            println!("Deleted {} old messages (older than {} days)", deleted, days);
        }

        Ok(deleted)
    }

    pub fn get_message_stats(&self, consultation_id: &str) -> Result<MessageStats, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut total_stmt = conn.prepare("SELECT COUNT(*) FROM messages WHERE consultation_id = ?1")?;
        let total_count: i64 = total_stmt.query_row(params![consultation_id], |row| row.get(0))?;

        let mut unread_stmt = conn.prepare("SELECT COUNT(*) FROM messages WHERE consultation_id = ?1 AND read_status = 'unread'")?;
        let unread_count: i64 = unread_stmt.query_row(params![consultation_id], |row| row.get(0))?;

        let mut pending_stmt = conn.prepare("SELECT COUNT(*) FROM messages WHERE consultation_id = ?1 AND sync_status = 'pending'")?;
        let pending_sync_count: i64 = pending_stmt.query_row(params![consultation_id], |row| row.get(0))?;

        Ok(MessageStats {
            total: total_count,
            unread: unread_count,
            pending_sync: pending_sync_count,
        })
    }
}

#[derive(Debug, Clone)]
pub struct MessageStats {
    pub total: i64,
    pub unread: i64,
    pub pending_sync: i64,
}

impl BaseDao<Message> for MessageDao {
    fn create(&self, message: &Message) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO messages (id, consultation_id, sender_type, message_type, content, file_path, file_size, mime_type, timestamp, sync_status, read_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                message.consultation_id,
                message.sender_type,
                message.message_type,
                message.content,
                message.file_path,
                message.file_size,
                message.mime_type,
                message.timestamp,
                message.sync_status,
                message.read_status
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<Message>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, consultation_id, sender_type, message_type, content, file_path, file_size, mime_type, timestamp, sync_status, read_status
             FROM messages WHERE id = ?1"
        )?;

        let message_result = stmt.query_row(params![id], |row| {
            Ok(Message {
                id: row.get(0)?,
                consultation_id: row.get(1)?,
                sender_type: row.get(2)?,
                message_type: row.get(3)?,
                content: row.get(4)?,
                file_path: row.get(5)?,
                file_size: row.get(6)?,
                mime_type: row.get(7)?,
                timestamp: row.get(8)?,
                sync_status: row.get(9)?,
                read_status: row.get(10)?,
            })
        });

        match message_result {
            Ok(message) => Ok(Some(message)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, message: &Message) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        conn.execute(
            "UPDATE messages SET consultation_id = ?1, sender_type = ?2, message_type = ?3, content = ?4,
             file_path = ?5, file_size = ?6, mime_type = ?7, timestamp = ?8, sync_status = ?9, read_status = ?10
             WHERE id = ?11",
            params![
                message.consultation_id,
                message.sender_type,
                message.message_type,
                message.content,
                message.file_path,
                message.file_size,
                message.mime_type,
                message.timestamp,
                message.sync_status,
                message.read_status,
                message.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<Message>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, consultation_id, sender_type, message_type, content, file_path, file_size, mime_type, timestamp, sync_status, read_status
             FROM messages ORDER BY timestamp DESC"
        )?;

        let message_iter = stmt.query_map([], |row| {
            Ok(Message {
                id: row.get(0)?,
                consultation_id: row.get(1)?,
                sender_type: row.get(2)?,
                message_type: row.get(3)?,
                content: row.get(4)?,
                file_path: row.get(5)?,
                file_size: row.get(6)?,
                mime_type: row.get(7)?,
                timestamp: row.get(8)?,
                sync_status: row.get(9)?,
                read_status: row.get(10)?,
            })
        })?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message?);
        }

        Ok(messages)
    }
}

impl Default for MessageDao {
    fn default() -> Self {
        Self::new()
    }
}