// 数据库模块

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::AppHandle;

pub async fn init_database(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // 确保应用数据目录存在
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_dir.join("telemedicine.db");

    // 创建数据库连接
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // 创建表结构
    create_tables(&conn)?;

    println!("Database initialized at: {:?}", db_path);
    Ok(())
}

fn create_tables(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    // 用户认证表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            encrypted_token TEXT,
            last_login DATETIME,
            session_expires DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 患者信息表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER,
            gender TEXT,
            phone TEXT,
            tags TEXT, -- JSON数组
            last_sync DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 问诊记录表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS consultations (
            id TEXT PRIMARY KEY,
            patient_id TEXT,
            doctor_id TEXT,
            status TEXT, -- 'pending', 'active', 'completed', 'cancelled'
            consultation_type TEXT, -- 'text', 'video', 'voice'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )",
        [],
    )?;

    // 消息记录表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            consultation_id TEXT,
            sender_type TEXT, -- 'doctor', 'patient'
            message_type TEXT, -- 'text', 'image', 'voice', 'file'
            content TEXT,
            file_path TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'failed'
            FOREIGN KEY (consultation_id) REFERENCES consultations (id)
        )",
        [],
    )?;

    // 文件缓存表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS file_cache (
            id TEXT PRIMARY KEY,
            file_url TEXT,
            local_path TEXT,
            file_size INTEGER,
            mime_type TEXT,
            downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 医疗记录表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS medical_records (
            id TEXT PRIMARY KEY,
            patient_id TEXT,
            doctor_id TEXT,
            diagnosis TEXT,
            treatment TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )",
        [],
    )?;

    // 创建索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (name)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_consultation ON messages (consultation_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations (patient_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations (status)",
        [],
    )?;

    println!("Database tables created successfully");
    Ok(())
}