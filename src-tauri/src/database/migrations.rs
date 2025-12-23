// 数据库迁移管理

use rusqlite::{Connection, Result};
use std::collections::HashMap;

pub struct Migration {
    pub version: i32,
    pub description: String,
    pub up_sql: String,
    pub down_sql: String,
}

pub struct MigrationManager {
    migrations: HashMap<i32, Migration>,
}

impl MigrationManager {
    pub fn new() -> Self {
        let mut migrations = HashMap::new();

        // 初始化迁移
        migrations.insert(1, Migration {
            version: 1,
            description: "Initial database schema".to_string(),
            up_sql: include_str!("../../migrations/001_initial_schema.sql").to_string(),
            down_sql: "DROP TABLE IF EXISTS file_cache; DROP TABLE IF EXISTS medical_records; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS consultations; DROP TABLE IF EXISTS patients; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS schema_migrations;".to_string(),
        });

        Self { migrations }
    }

    pub fn run_migrations(&self, conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        // 创建迁移表
        self.create_migration_table(conn)?;

        // 获取当前版本
        let current_version = self.get_current_version(conn)?;

        // 运行待执行的迁移
        let mut versions: Vec<i32> = self.migrations.keys().cloned().collect();
        versions.sort();

        for version in versions {
            if version > current_version {
                if let Some(migration) = self.migrations.get(&version) {
                    println!("Running migration {}: {}", version, migration.description);
                    self.run_migration(conn, migration)?;
                }
            }
        }

        Ok(())
    }

    fn create_migration_table(&self, conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        Ok(())
    }

    fn get_current_version(&self, conn: &Connection) -> Result<i32, Box<dyn std::error::Error>> {
        let mut stmt = conn.prepare("SELECT MAX(version) FROM schema_migrations")?;
        let version: Option<i32> = stmt.query_row([], |row| row.get(0)).unwrap_or(None);
        Ok(version.unwrap_or(0))
    }

    fn run_migration(&self, conn: &Connection, migration: &Migration) -> Result<(), Box<dyn std::error::Error>> {
        // 开始事务
        let tx = conn.unchecked_transaction()?;

        // 执行迁移SQL
        tx.execute_batch(&migration.up_sql)?;

        // 记录迁移
        tx.execute(
            "INSERT INTO schema_migrations (version, description) VALUES (?1, ?2)",
            [&migration.version.to_string(), &migration.description],
        )?;

        // 提交事务
        tx.commit()?;

        println!("Migration {} completed successfully", migration.version);
        Ok(())
    }
}