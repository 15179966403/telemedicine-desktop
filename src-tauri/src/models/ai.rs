// AI 智能体模型定义
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSession {
    pub id: String,
    pub patient_id: String,
    pub title: String,
    pub model: String,
    pub rolling_summary: Option<String>,
    pub system_prompt: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub id: String,
    pub session_id: String,
    pub role: String, // "user" | "assistant" | "system" | "tool"
    pub content: Option<String>,
    pub reasoning_content: Option<String>,
    pub tool_calls: Option<String>,
    pub tool_call_id: Option<String>,
    pub is_archived: i32,
    pub tokens_estimate: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiIdempotencyRecord {
    pub idempotency_key: String,
    pub action_type: String,
    pub session_id: Option<String>,
    pub request_hash: String,
    pub status: String, // "pending" | "processing" | "completed" | "failed"
    pub result_payload: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiToolAuditRecord {
    pub id: String,
    pub session_id: String,
    pub tool_name: String,
    pub security_level: String, // "L1" | "L2" | "L3"
    pub parameters: Option<String>,
    pub user_action: Option<String>, // "auto_allowed" | "confirmed" | "rejected"
    pub execution_result: Option<String>,
    pub created_at: String,
}
