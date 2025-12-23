-- 初始数据库架构
-- 版本: 1
-- 描述: 创建基础表结构

-- 用户认证表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    encrypted_token TEXT,
    last_login DATETIME,
    session_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 患者信息表
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
    phone TEXT,
    id_card TEXT,
    tags TEXT, -- JSON数组格式存储标签
    avatar_url TEXT,
    last_sync DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 问诊记录表
CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    consultation_type TEXT NOT NULL DEFAULT 'text' CHECK (consultation_type IN ('text', 'video', 'voice')),
    title TEXT,
    description TEXT,
    diagnosis TEXT,
    prescription TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);

-- 消息记录表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    consultation_id TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('doctor', 'patient')),
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'voice', 'file')),
    content TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    read_status TEXT DEFAULT 'unread' CHECK (read_status IN ('unread', 'read')),
    FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE CASCADE
);

-- 医疗记录表
CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    consultation_id TEXT,
    record_type TEXT NOT NULL CHECK (record_type IN ('diagnosis', 'prescription', 'examination', 'treatment')),
    title TEXT NOT NULL,
    content TEXT,
    attachments TEXT, -- JSON数组格式存储附件信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
    FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE SET NULL
);

-- 文件缓存表
CREATE TABLE IF NOT EXISTS file_cache (
    id TEXT PRIMARY KEY,
    file_url TEXT UNIQUE NOT NULL,
    local_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    checksum TEXT,
    expires_at DATETIME,
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表 (用于安全审计)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT, -- JSON格式存储详细信息
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能

-- 患者相关索引
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at);

-- 问诊相关索引
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations (patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations (doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations (status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations (created_at);

-- 消息相关索引
CREATE INDEX IF NOT EXISTS idx_messages_consultation ON messages (consultation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_sync_status ON messages (sync_status);

-- 医疗记录索引
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records (patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor ON medical_records (doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_consultation ON medical_records (consultation_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records (record_type);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON medical_records (created_at);

-- 文件缓存索引
CREATE INDEX IF NOT EXISTS idx_file_cache_url ON file_cache (file_url);
CREATE INDEX IF NOT EXISTS idx_file_cache_expires ON file_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_file_cache_accessed ON file_cache (last_accessed);

-- 审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);