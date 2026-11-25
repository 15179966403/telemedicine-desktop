-- AI Person Agent 数据库架构
-- 版本: 2
-- 描述: 客户单会话(1:1 Session)、消息历史、纯客户端幂等控制表与工具审计记录表

-- 1. 客户单会话表 (1 Patient = 1 Session)
CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'deepseek-4.1-flash',
    rolling_summary TEXT,
    system_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);

-- 2. 会话历史消息表
CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    reasoning_content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    is_archived INTEGER DEFAULT 0,
    tokens_estimate INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES ai_sessions (id) ON DELETE CASCADE
);

-- 3. 本地幂等控制表 (保证纯客户端无后端下的防重与缓存复用)
CREATE TABLE IF NOT EXISTS ai_idempotency_records (
    idempotency_key TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    session_id TEXT,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_payload TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 工具审计与人机确认记录表
CREATE TABLE IF NOT EXISTS ai_tool_audit_records (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    security_level TEXT NOT NULL CHECK (security_level IN ('L1', 'L2', 'L3')),
    parameters TEXT,
    user_action TEXT CHECK (user_action IN ('auto_allowed', 'confirmed', 'rejected')),
    execution_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 系统本地设置表 (存储加密的 API Key 等)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引构建
CREATE INDEX IF NOT EXISTS idx_ai_sessions_patient ON ai_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_idempotency_status ON ai_idempotency_records(status);
CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_session ON ai_tool_audit_records(session_id);
