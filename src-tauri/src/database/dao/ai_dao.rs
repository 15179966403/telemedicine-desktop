// AI 专属数据访问层 (AiDao)
use crate::database::connection::{get_database, try_get_database, DbConnection};
use crate::models::{AiSession, AiMessage, AiIdempotencyRecord, AiToolAuditRecord};
use rusqlite::{params, OptionalExtension, Result};
use uuid::Uuid;

pub struct AiDao {
    connection: DbConnection,
}

impl AiDao {
    pub fn new() -> Self {
        Self::try_new().unwrap_or_else(|e| panic!("{}", e))
    }

    pub fn try_new() -> Result<Self, String> {
        let db = try_get_database()?;
        Ok(Self {
            connection: db.get_connection(),
        })
    }

    /// 获取或创建指定客户的唯一固定 Session (1:1 绑定)
    pub fn get_or_create_session(&self, patient_id: &str, default_title: &str) -> Result<AiSession, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // 1. 先尝试查询已有 Session
        let mut stmt = conn.prepare(
            "SELECT id, patient_id, title, model, rolling_summary, system_prompt, created_at, updated_at
             FROM ai_sessions WHERE patient_id = ?1"
        )?;

        let existing = stmt.query_row(params![patient_id], |row| {
            Ok(AiSession {
                id: row.get(0)?,
                patient_id: row.get(1)?,
                title: row.get(2)?,
                model: row.get(3)?,
                rolling_summary: row.get(4)?,
                system_prompt: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).optional()?;

        if let Some(session) = existing {
            return Ok(session);
        }

        // 2. 没有则插入新会话
        let session_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO ai_sessions (id, patient_id, title, model, rolling_summary, system_prompt)
             VALUES (?1, ?2, ?3, 'deepseek-4.1-flash', NULL, NULL)",
            params![session_id, patient_id, default_title],
        )?;

        let new_session = AiSession {
            id: session_id,
            patient_id: patient_id.to_string(),
            title: default_title.to_string(),
            model: "deepseek-4.1-flash".to_string(),
            rolling_summary: None,
            system_prompt: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        Ok(new_session)
    }

    /// 更新滚动摘要并归档早期历史消息
    pub fn update_rolling_summary(
        &self,
        session_id: &str,
        summary: &str,
        archive_before_created_at: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.connection.lock().unwrap();
        let tx = conn.transaction()?;

        // 更新 session 摘要
        tx.execute(
            "UPDATE ai_sessions SET rolling_summary = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![summary, session_id],
        )?;

        // 归档旧消息
        if let Some(time_threshold) = archive_before_created_at {
            tx.execute(
                "UPDATE ai_messages SET is_archived = 1 WHERE session_id = ?1 AND created_at <= ?2",
                params![session_id, time_threshold],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    /// 保存 AI 消息
    pub fn save_message(&self, msg: &AiMessage) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO ai_messages (id, session_id, role, content, reasoning_content, tool_calls, tool_call_id, is_archived, tokens_estimate)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                msg.id,
                msg.session_id,
                msg.role,
                msg.content,
                msg.reasoning_content,
                msg.tool_calls,
                msg.tool_call_id,
                msg.is_archived,
                msg.tokens_estimate,
            ],
        )?;

        // 同步更新 session updated_at
        let _ = conn.execute(
            "UPDATE ai_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![msg.session_id],
        );

        Ok(())
    }

    /// 获取活跃未归档的消息（供日常对话上下文组合）
    pub fn get_active_messages(&self, session_id: &str, limit: i64) -> Result<Vec<AiMessage>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, reasoning_content, tool_calls, tool_call_id, is_archived, tokens_estimate, created_at
             FROM ai_messages
             WHERE session_id = ?1 AND is_archived = 0
             ORDER BY created_at ASC
             LIMIT ?2"
        )?;

        let iter = stmt.query_map(params![session_id, limit], |row| {
            Ok(AiMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                reasoning_content: row.get(4)?,
                tool_calls: row.get(5)?,
                tool_call_id: row.get(6)?,
                is_archived: row.get(7)?,
                tokens_estimate: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;

        let mut messages = Vec::new();
        for msg in iter {
            messages.push(msg?);
        }

        Ok(messages)
    }

    /// 获取该 Session 的所有消息（包含已归档，用于界面历史分页滚动）
    pub fn get_all_messages(&self, session_id: &str, page: i32, page_size: i32) -> Result<Vec<AiMessage>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let offset = (page - 1) * page_size;
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, reasoning_content, tool_calls, tool_call_id, is_archived, tokens_estimate, created_at
             FROM ai_messages
             WHERE session_id = ?1
             ORDER BY created_at ASC
             LIMIT ?2 OFFSET ?3"
        )?;

        let iter = stmt.query_map(params![session_id, page_size, offset], |row| {
            Ok(AiMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                reasoning_content: row.get(4)?,
                tool_calls: row.get(5)?,
                tool_call_id: row.get(6)?,
                is_archived: row.get(7)?,
                tokens_estimate: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;

        let mut messages = Vec::new();
        for msg in iter {
            messages.push(msg?);
        }

        Ok(messages)
    }

    /// 幂等性控制：检查并初始化记录（如果不存在则插入 pending，已存在则返回已有状态）
    pub fn check_or_init_idempotency(
        &self,
        idempotency_key: &str,
        action_type: &str,
        session_id: Option<&str>,
        request_hash: &str,
    ) -> Result<AiIdempotencyRecord, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // 尝试查询已有
        let mut stmt = conn.prepare(
            "SELECT idempotency_key, action_type, session_id, request_hash, status, result_payload, error_message, created_at, updated_at
             FROM ai_idempotency_records WHERE idempotency_key = ?1"
        )?;

        let existing = stmt.query_row(params![idempotency_key], |row| {
            Ok(AiIdempotencyRecord {
                idempotency_key: row.get(0)?,
                action_type: row.get(1)?,
                session_id: row.get(2)?,
                request_hash: row.get(3)?,
                status: row.get(4)?,
                result_payload: row.get(5)?,
                error_message: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        }).optional()?;

        if let Some(record) = existing {
            return Ok(record);
        }

        // 不存在则原子插入 pending
        conn.execute(
            "INSERT INTO ai_idempotency_records (idempotency_key, action_type, session_id, request_hash, status)
             VALUES (?1, ?2, ?3, ?4, 'pending')",
            params![idempotency_key, action_type, session_id, request_hash],
        )?;

        Ok(AiIdempotencyRecord {
            idempotency_key: idempotency_key.to_string(),
            action_type: action_type.to_string(),
            session_id: session_id.map(|s| s.to_string()),
            request_hash: request_hash.to_string(),
            status: "pending".to_string(),
            result_payload: None,
            error_message: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// 标记幂等完成
    pub fn complete_idempotency(&self, idempotency_key: &str, result_payload: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE ai_idempotency_records
             SET status = 'completed', result_payload = ?1, updated_at = CURRENT_TIMESTAMP
             WHERE idempotency_key = ?2",
            params![result_payload, idempotency_key],
        )?;
        Ok(())
    }

    /// 标记幂等失败
    pub fn fail_idempotency(&self, idempotency_key: &str, error_message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE ai_idempotency_records
             SET status = 'failed', error_message = ?1, updated_at = CURRENT_TIMESTAMP
             WHERE idempotency_key = ?2",
            params![error_message, idempotency_key],
        )?;
        Ok(())
    }

    /// 记录工具审计日志
    pub fn log_tool_audit(&self, audit: &AiToolAuditRecord) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO ai_tool_audit_records (id, session_id, tool_name, security_level, parameters, user_action, execution_result)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                audit.id,
                audit.session_id,
                audit.tool_name,
                audit.security_level,
                audit.parameters,
                audit.user_action,
                audit.execution_result,
            ],
        )?;
        Ok(())
    }

    /// 获取工具审计列表
    pub fn get_tool_audits(&self, session_id: &str, limit: i64) -> Result<Vec<AiToolAuditRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, tool_name, security_level, parameters, user_action, execution_result, created_at
             FROM ai_tool_audit_records WHERE session_id = ?1 ORDER BY created_at DESC LIMIT ?2"
        )?;

        let iter = stmt.query_map(params![session_id, limit], |row| {
            Ok(AiToolAuditRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                tool_name: row.get(2)?,
                security_level: row.get(3)?,
                parameters: row.get(4)?,
                user_action: row.get(5)?,
                execution_result: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut audits = Vec::new();
        for item in iter {
            audits.push(item?);
        }

        Ok(audits)
    }

    /// 保存本地应用设置（键值对，如加密密钥）
    pub fn save_setting(&self, key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
            params![key, value],
        )?;
        Ok(())
    }

    /// 读取本地应用设置
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let res = stmt.query_row(params![key], |row| row.get(0)).optional()?;
        Ok(res)
    }
}
