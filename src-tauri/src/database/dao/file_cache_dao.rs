// 文件缓存数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::BaseDao;
use crate::models::FileCache;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct FileCacheDao {
    connection: DbConnection,
}

impl FileCacheDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn find_by_url(&self, file_url: &str) -> Result<Option<FileCache>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_url, local_path, file_size, mime_type, checksum, expires_at, downloaded_at, last_accessed
             FROM file_cache WHERE file_url = ?1"
        )?;

        let cache_result = stmt.query_row(params![file_url], |row| {
            Ok(FileCache {
                id: row.get(0)?,
                file_url: row.get(1)?,
                local_path: row.get(2)?,
                file_size: row.get(3)?,
                mime_type: row.get(4)?,
                checksum: row.get(5)?,
                expires_at: row.get(6)?,
                downloaded_at: row.get(7)?,
                last_accessed: row.get(8)?,
            })
        });

        match cache_result {
            Ok(cache) => Ok(Some(cache)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub fn find_expired_files(&self) -> Result<Vec<FileCache>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_url, local_path, file_size, mime_type, checksum, expires_at, downloaded_at, last_accessed
             FROM file_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
        )?;

        let cache_iter = stmt.query_map([], |row| {
            Ok(FileCache {
                id: row.get(0)?,
                file_url: row.get(1)?,
                local_path: row.get(2)?,
                file_size: row.get(3)?,
                mime_type: row.get(4)?,
                checksum: row.get(5)?,
                expires_at: row.get(6)?,
                downloaded_at: row.get(7)?,
                last_accessed: row.get(8)?,
            })
        })?;

        let mut files = Vec::new();
        for file in cache_iter {
            files.push(file?);
        }

        Ok(files)
    }

    pub fn find_old_files(&self, days: i32) -> Result<Vec<FileCache>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_url, local_path, file_size, mime_type, checksum, expires_at, downloaded_at, last_accessed
             FROM file_cache WHERE last_accessed < datetime('now', '-' || ?1 || ' days')"
        )?;

        let cache_iter = stmt.query_map(params![days], |row| {
            Ok(FileCache {
                id: row.get(0)?,
                file_url: row.get(1)?,
                local_path: row.get(2)?,
                file_size: row.get(3)?,
                mime_type: row.get(4)?,
                checksum: row.get(5)?,
                expires_at: row.get(6)?,
                downloaded_at: row.get(7)?,
                last_accessed: row.get(8)?,
            })
        })?;

        let mut files = Vec::new();
        for file in cache_iter {
            files.push(file?);
        }

        Ok(files)
    }

    pub fn update_last_accessed(&self, file_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE file_cache SET last_accessed = ?1 WHERE id = ?2",
            params![now, file_id],
        )?;

        Ok(())
    }

    pub fn get_cache_size(&self) -> Result<i64, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COALESCE(SUM(file_size), 0) FROM file_cache")?;
        let total_size: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(total_size)
    }

    pub fn get_cache_stats(&self) -> Result<CacheStats, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut count_stmt = conn.prepare("SELECT COUNT(*) FROM file_cache")?;
        let total_files: i64 = count_stmt.query_row([], |row| row.get(0))?;

        let mut size_stmt = conn.prepare("SELECT COALESCE(SUM(file_size), 0) FROM file_cache")?;
        let total_size: i64 = size_stmt.query_row([], |row| row.get(0))?;

        let mut expired_stmt = conn.prepare("SELECT COUNT(*) FROM file_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')")?;
        let expired_files: i64 = expired_stmt.query_row([], |row| row.get(0))?;

        Ok(CacheStats {
            total_files,
            total_size,
            expired_files,
        })
    }

    pub fn cleanup_expired(&self) -> Result<usize, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let deleted = conn.execute(
            "DELETE FROM file_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')",
            [],
        )?;

        Ok(deleted)
    }

    pub fn cleanup_old_files(&self, days: i32) -> Result<usize, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let deleted = conn.execute(
            "DELETE FROM file_cache WHERE last_accessed < datetime('now', '-' || ?1 || ' days')",
            params![days],
        )?;

        Ok(deleted)
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub total_files: i64,
    pub total_size: i64,
    pub expired_files: i64,
}

impl BaseDao<FileCache> for FileCacheDao {
    fn create(&self, cache: &FileCache) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        conn.execute(
            "INSERT INTO file_cache (id, file_url, local_path, file_size, mime_type, checksum, expires_at, downloaded_at, last_accessed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                cache.file_url,
                cache.local_path,
                cache.file_size,
                cache.mime_type,
                cache.checksum,
                cache.expires_at,
                now,
                now
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<FileCache>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_url, local_path, file_size, mime_type, checksum, expires_at, downloaded_at, last_accessed
             FROM file_cache WHERE id = ?1"
        )?;

        let cache_result = stmt.query_row(params![id], |row| {
            Ok(FileCache {
                id: row.get(0)?,
                file_url: row.get(1)?,
                local_path: row.get(2)?,
                file_size: row.get(3)?,
                mime_type: row.get(4)?,
                checksum: row.get(5)?,
                expires_at: row.get(6)?,
                downloaded_at: row.get(7)?,
                last_accessed: row.get(8)?,
            })
        });

        match cache_result {
            Ok(cache) => Ok(Some(cache)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, cache: &FileCache) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        conn.execute(
            "UPDATE file_cache SET file_url = ?1, local_path = ?2, file_size = ?3, mime_type = ?4,
             checksum = ?5, expires_at = ?6, downloaded_at = ?7, last_accessed = ?8 WHERE id = ?9",
            params![
                cache.file_url,
                cache.local_path,
                cache.file_size,
                cache.mime_type,
                cache.checksum,
                cache.expires_at,
                cache.downloaded_at,
                cache.last_accessed,
                cache.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM file_cache WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<FileCache>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_url, local_path, file_size, mime_type, checksum, expires_at, downloaded_at, last_accessed
             FROM file_cache ORDER BY downloaded_at DESC"
        )?;

        let cache_iter = stmt.query_map([], |row| {
            Ok(FileCache {
                id: row.get(0)?,
                file_url: row.get(1)?,
                local_path: row.get(2)?,
                file_size: row.get(3)?,
                mime_type: row.get(4)?,
                checksum: row.get(5)?,
                expires_at: row.get(6)?,
                downloaded_at: row.get(7)?,
                last_accessed: row.get(8)?,
            })
        })?;

        let mut files = Vec::new();
        for file in cache_iter {
            files.push(file?);
        }

        Ok(files)
    }
}

impl Default for FileCacheDao {
    fn default() -> Self {
        Self::new()
    }
}