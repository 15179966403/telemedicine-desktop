// 数据库连接管理

use rusqlite::{Connection, OpenFlags, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use crate::database::migrations::MigrationManager;

pub type DbConnection = Arc<Mutex<Connection>>;

pub struct DatabaseManager {
    connection: DbConnection,
    db_path: PathBuf,
}

impl DatabaseManager {
    pub async fn new(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        // 确保应用数据目录存在
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        let db_path = app_dir.join("telemedicine.db");

        // 创建数据库连接，启用外键约束和WAL模式
        let conn = Connection::open_with_flags(
            &db_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;

        // 配置数据库
        Self::configure_connection(&conn)?;

        let connection = Arc::new(Mutex::new(conn));

        let manager = Self {
            connection: connection.clone(),
            db_path,
        };

        // 运行数据库迁移
        manager.run_migrations().await?;

        println!("Database initialized at: {:?}", manager.db_path);
        Ok(manager)
    }

    fn configure_connection(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        // 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // 启用WAL模式以提高并发性能
        conn.execute("PRAGMA journal_mode = WAL", [])?;

        // 设置同步模式为NORMAL以平衡性能和安全性
        conn.execute("PRAGMA synchronous = NORMAL", [])?;

        // 设置缓存大小 (10MB)
        conn.execute("PRAGMA cache_size = -10000", [])?;

        // 设置临时存储为内存
        conn.execute("PRAGMA temp_store = MEMORY", [])?;

        // 设置mmap大小 (256MB)
        conn.execute("PRAGMA mmap_size = 268435456", [])?;

        Ok(())
    }

    pub async fn run_migrations(&self) -> Result<(), Box<dyn std::error::Error>> {
        let migration_manager = MigrationManager::new();
        let conn = self.connection.lock().unwrap();
        migration_manager.run_migrations(&*conn)?;
        Ok(())
    }

    pub fn get_connection(&self) -> DbConnection {
        self.connection.clone()
    }

    pub fn get_db_path(&self) -> &PathBuf {
        &self.db_path
    }

    // 数据库健康检查
    pub fn health_check(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT 1")?;
        let result: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(result == 1)
    }

    // 获取数据库统计信息
    pub fn get_stats(&self) -> Result<DatabaseStats, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")?;
        let table_rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut table_counts = std::collections::HashMap::new();

        for table_result in table_rows {
            let table_name = table_result?;
            if !table_name.starts_with("sqlite_") && table_name != "schema_migrations" {
                let count_sql = format!("SELECT COUNT(*) FROM {}", table_name);
                let mut count_stmt = conn.prepare(&count_sql)?;
                let count: i64 = count_stmt.query_row([], |row| row.get(0))?;
                table_counts.insert(table_name, count);
            }
        }

        // 获取数据库文件大小
        let file_size = std::fs::metadata(&self.db_path)?.len();

        Ok(DatabaseStats {
            file_size,
            table_counts,
        })
    }

    // 数据库备份
    pub fn backup(&self, backup_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // 创建备份目录
        if let Some(parent) = backup_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // 执行备份
        let backup_conn = Connection::open(backup_path)?;
        let backup = rusqlite::backup::Backup::new(&*conn, &backup_conn)?;
        backup.run_to_completion(5, std::time::Duration::from_millis(250), None)?;

        println!("Database backup completed: {:?}", backup_path);
        Ok(())
    }

    // 清理过期缓存
    pub fn cleanup_expired_cache(&self) -> Result<usize, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let deleted = conn.execute(
            "DELETE FROM file_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')",
            [],
        )?;

        if deleted > 0 {
            println!("Cleaned up {} expired cache entries", deleted);
        }

        Ok(deleted)
    }
}

#[derive(Debug)]
pub struct DatabaseStats {
    pub file_size: u64,
    pub table_counts: std::collections::HashMap<String, i64>,
}

// 全局数据库管理器实例
static mut DATABASE_MANAGER: Option<DatabaseManager> = None;
static INIT: std::sync::Once = std::sync::Once::new();

pub async fn init_database(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let manager = DatabaseManager::new(app).await?;

    unsafe {
        INIT.call_once(|| {
            DATABASE_MANAGER = Some(manager);
        });
    }

    Ok(())
}

pub fn get_database() -> &'static DatabaseManager {
    unsafe {
        DATABASE_MANAGER.as_ref().expect("Database not initialized")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_database_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let conn = Connection::open(&db_path).unwrap();
        DatabaseManager::configure_connection(&conn).unwrap();

        // 验证配置是否生效
        let mut stmt = conn.prepare("PRAGMA foreign_keys").unwrap();
        let foreign_keys: i32 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(foreign_keys, 1);
    }

    #[tokio::test]
    async fn test_health_check() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let conn = Connection::open(&db_path).unwrap();
        let connection = Arc::new(Mutex::new(conn));

        let manager = DatabaseManager {
            connection,
            db_path,
        };

        assert!(manager.health_check().unwrap());
    }
}