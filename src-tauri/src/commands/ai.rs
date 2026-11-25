// AI 智能体指令模块 (Tauri 2 命令)
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use futures_util::StreamExt;
use crate::database::dao::AiDao;
use crate::models::{AiSession, AiMessage, AiIdempotencyRecord, AiToolAuditRecord};

// 存储活动请求的中断通知 Channel
type AbortMap = Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>>;
static mut ABORT_MAP: Option<AbortMap> = None;
static INIT_ABORT: std::sync::Once = std::sync::Once::new();

fn get_abort_map() -> &'static AbortMap {
    unsafe {
        INIT_ABORT.call_once(|| {
            ABORT_MAP = Some(Arc::new(Mutex::new(HashMap::new())));
        });
        ABORT_MAP.as_ref().unwrap()
    }
}

// -------------------------------------------------------------
// 请求与响应数据结构定义
// -------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct StreamChatRequest {
    pub request_id: String,
    pub session_id: String,
    pub messages: Vec<serde_json::Value>,
    pub tools: Option<Vec<serde_json::Value>>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamChunkPayload {
    pub request_id: String,
    pub delta_content: Option<String>,
    pub delta_reasoning: Option<String>,
    pub tool_calls: Option<serde_json::Value>,
    pub done: bool,
    pub error: Option<String>,
}

// -------------------------------------------------------------
// API Key 安全加解密与存储
// -------------------------------------------------------------
pub const ENCRYPTION_KEY_SETTING: &str = "deepseek_api_key_encrypted";
pub const BASE_URL_SETTING: &str = "deepseek_base_url";
pub const MODEL_SETTING: &str = "deepseek_model";

pub const DEFAULT_BASE_URL: &str = "https://api.deepseek.com/v1";
pub const DEFAULT_MODEL: &str = "deepseek-chat";
const SALT_MAGIC: &[u8; 16] = b"TelemedSecureKey";

#[derive(Debug, Serialize, Deserialize)]
pub struct AIConfigDto {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIConfigStatusDto {
    pub has_configured: bool,
    pub base_url: String,
    pub model: String,
}

fn simple_mask(input: &str) -> String {
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(input.as_bytes());
    let mut xored = Vec::new();
    for (i, b) in b64.bytes().enumerate() {
        xored.push(b ^ SALT_MAGIC[i % SALT_MAGIC.len()]);
    }
    base64::engine::general_purpose::STANDARD.encode(&xored)
}

fn simple_unmask(input: &str) -> Result<String, String> {
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(input)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    let mut unxored = Vec::new();
    for (i, b) in raw.into_iter().enumerate() {
        unxored.push(b ^ SALT_MAGIC[i % SALT_MAGIC.len()]);
    }
    let s = String::from_utf8(unxored).map_err(|e| format!("UTF8 error: {}", e))?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("Inner b64 error: {}", e))?;
    String::from_utf8(decoded).map_err(|e| format!("Final UTF8 error: {}", e))
}

#[tauri::command]
pub async fn ai_save_api_key(api_key: String) -> Result<(), String> {
    let ai_dao = AiDao::try_new()?;
    let masked = simple_mask(&api_key.trim());
    ai_dao.save_setting(ENCRYPTION_KEY_SETTING, &masked).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn ai_get_api_key_status() -> Result<bool, String> {
    let ai_dao = AiDao::try_new()?;
    match ai_dao.get_setting(ENCRYPTION_KEY_SETTING).map_err(|e| e.to_string())? {
        Some(val) => Ok(!val.trim().is_empty()),
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn ai_save_config(config: AIConfigDto) -> Result<(), String> {
    let ai_dao = AiDao::try_new()?;
    if let Some(key) = config.api_key {
        if !key.trim().is_empty() {
            let masked = simple_mask(&key.trim());
            ai_dao.save_setting(ENCRYPTION_KEY_SETTING, &masked).map_err(|e| e.to_string())?;
        }
    }
    if let Some(url) = config.base_url {
        let trimmed = url.trim().trim_end_matches('/').to_string();
        ai_dao.save_setting(BASE_URL_SETTING, &trimmed).map_err(|e| e.to_string())?;
    }
    if let Some(model) = config.model {
        let trimmed = model.trim().to_string();
        ai_dao.save_setting(MODEL_SETTING, &trimmed).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_get_config() -> Result<AIConfigStatusDto, String> {
    let ai_dao = AiDao::try_new()?;
    let has_key = match ai_dao.get_setting(ENCRYPTION_KEY_SETTING).map_err(|e| e.to_string())? {
        Some(val) => !val.trim().is_empty(),
        None => false,
    };
    let base_url = ai_dao
        .get_setting(BASE_URL_SETTING)
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
    let model = ai_dao
        .get_setting(MODEL_SETTING)
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    Ok(AIConfigStatusDto {
        has_configured: has_key,
        base_url,
        model,
    })
}

#[tauri::command]
pub async fn ai_test_connection(config: AIConfigDto) -> Result<String, String> {
    let ai_dao = AiDao::try_new()?;
    let key = if let Some(k) = config.api_key {
        if !k.trim().is_empty() {
            k.trim().to_string()
        } else {
            get_active_api_key()?
        }
    } else {
        get_active_api_key()?
    };

    let base_url = config.base_url.unwrap_or_else(|| {
        ai_dao
            .get_setting(BASE_URL_SETTING)
            .ok()
            .flatten()
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
    });

    let model = config.model.unwrap_or_else(|| {
        ai_dao
            .get_setting(MODEL_SETTING)
            .ok()
            .flatten()
            .unwrap_or_else(|| DEFAULT_MODEL.to_string())
    });

    let endpoint = format!("{}/chat/completions", base_url.trim().trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "user", "content": "ping"}
        ],
        "max_tokens": 5,
        "stream": false
    });

    let res = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求连接失败，请检查网络或 URL 是否正确: {}", e))?;

    let status = res.status();
    if status.is_success() {
        Ok(format!("连接成功！DeepSeek 接口正常响应 (HTTP {})，模型 [{}] 验证通过。", status, model))
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("接口返回错误 (HTTP {}): {}", status, err_text))
    }
}

fn get_active_api_key() -> Result<String, String> {
    let ai_dao = AiDao::try_new()?;
    let val = ai_dao.get_setting(ENCRYPTION_KEY_SETTING).map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置 DeepSeek API Key，请在系统设置中配置".to_string())?;
    simple_unmask(&val)
}

// -------------------------------------------------------------
// 原生流式请求 (方式 B)
// -------------------------------------------------------------

#[tauri::command]
pub async fn ai_chat_stream(app: AppHandle, request: StreamChatRequest) -> Result<(), String> {
    let api_key = get_active_api_key()?;
    let request_id = request.request_id.clone();
    let client = reqwest::Client::new();

    let ai_dao = AiDao::try_new()?;
    let base_url = ai_dao
        .get_setting(BASE_URL_SETTING)
        .ok()
        .flatten()
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
    let model = ai_dao
        .get_setting(MODEL_SETTING)
        .ok()
        .flatten()
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let endpoint = format!("{}/chat/completions", base_url.trim().trim_end_matches('/'));

    // 组装 OpenAI 兼容协议 Payload
    let mut body = serde_json::json!({
        "model": model,
        "messages": request.messages,
        "stream": true,
    });

    if let Some(tools) = request.tools {
        if !tools.is_empty() {
            body["tools"] = serde_json::Value::Array(tools);
        }
    }
    if let Some(temp) = request.temperature {
        body["temperature"] = serde_json::json!(temp);
    }
    if let Some(tokens) = request.max_tokens {
        body["max_tokens"] = serde_json::json!(tokens);
    }

    // 设置 Abort Channel
    let (abort_tx, mut abort_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut map = get_abort_map().lock().unwrap();
        map.insert(request_id.clone(), abort_tx);
    }

    let req_id_clone = request_id.clone();
    let app_handle = app.clone();

    // 在 Tokio 异步线程中处理流式响应
    tokio::spawn(async move {
        let emit_error = |err: &str| {
            let _ = app_handle.emit(
                "ai:chunk",
                StreamChunkPayload {
                    request_id: req_id_clone.clone(),
                    delta_content: None,
                    delta_reasoning: None,
                    tool_calls: None,
                    done: true,
                    error: Some(err.to_string()),
                },
            );
        };

        let response = match client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                emit_error(&format!("网络请求失败: {}", e));
                return;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            emit_error(&format!("API 返回错误 (HTTP {}): {}", status, text));
            return;
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        loop {
            tokio::select! {
                _ = &mut abort_rx => {
                    // 收到前端中止信号
                    let _ = app_handle.emit("ai:chunk", StreamChunkPayload {
                        request_id: req_id_clone.clone(),
                        delta_content: None,
                        delta_reasoning: None,
                        tool_calls: None,
                        done: true,
                        error: Some("已中止生成".to_string()),
                    });
                    break;
                }
                chunk_opt = stream.next() => {
                    match chunk_opt {
                        Some(Ok(bytes)) => {
                            if let Ok(text) = std::str::from_utf8(&bytes) {
                                buffer.push_str(text);

                                while let Some(pos) = buffer.find('\n') {
                                    let line = buffer[..pos].trim().to_string();
                                    buffer = buffer[pos + 1..].to_string();

                                    if line.starts_fmt(&"data:") || line.starts_with("data: ") {
                                        let json_str = line.trim_start_matches("data:").trim();
                                        if json_str == "[DONE]" {
                                            let _ = app_handle.emit("ai:chunk", StreamChunkPayload {
                                                request_id: req_id_clone.clone(),
                                                delta_content: None,
                                                delta_reasoning: None,
                                                tool_calls: None,
                                                done: true,
                                                error: None,
                                            });
                                            return;
                                        }

                                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                                            if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                                                if let Some(first) = choices.get(0) {
                                                    let delta = first.get("delta");
                                                    let content = delta.and_then(|d| d.get("content")).and_then(|c| c.as_str()).map(|s| s.to_string());
                                                    let reasoning = delta.and_then(|d| d.get("reasoning_content")).and_then(|c| c.as_str()).map(|s| s.to_string());
                                                    let tools = delta.and_then(|d| d.get("tool_calls")).cloned();

                                                    let _ = app_handle.emit("ai:chunk", StreamChunkPayload {
                                                        request_id: req_id_clone.clone(),
                                                        delta_content: content,
                                                        delta_reasoning: reasoning,
                                                        tool_calls: tools,
                                                        done: false,
                                                        error: None,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            emit_error(&format!("流读取异常: {}", e));
                            break;
                        }
                        None => {
                            // 流正常结束
                            let _ = app_handle.emit("ai:chunk", StreamChunkPayload {
                                request_id: req_id_clone.clone(),
                                delta_content: None,
                                delta_reasoning: None,
                                tool_calls: None,
                                done: true,
                                error: None,
                            });
                            break;
                        }
                    }
                }
            }
        }

        // 移除 abort sender
        let mut map = get_abort_map().lock().unwrap();
        map.remove(&req_id_clone);
    });

    Ok(())
}

trait StartsFmt {
    fn starts_fmt(&self, pat: &str) -> bool;
}
impl StartsFmt for String {
    fn starts_fmt(&self, pat: &str) -> bool {
        self.starts_with(pat)
    }
}

#[tauri::command]
pub async fn ai_abort_generation(request_id: String) -> Result<(), String> {
    let mut map = get_abort_map().lock().unwrap();
    if let Some(tx) = map.remove(&request_id) {
        let _ = tx.send(());
    }
    Ok(())
}

// -------------------------------------------------------------
// 会话与消息管理 Commands
// -------------------------------------------------------------

#[tauri::command]
pub async fn ai_get_or_create_session(patient_id: String, default_title: String) -> Result<AiSession, String> {
    let dao = AiDao::try_new()?;
    dao.get_or_create_session(&patient_id, &default_title).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_get_active_messages(session_id: String, limit: Option<i64>) -> Result<Vec<AiMessage>, String> {
    let dao = AiDao::try_new()?;
    dao.get_active_messages(&session_id, limit.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_get_all_messages(session_id: String, page: i32, page_size: i32) -> Result<Vec<AiMessage>, String> {
    let dao = AiDao::try_new()?;
    dao.get_all_messages(&session_id, page, page_size).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_save_message(message: AiMessage) -> Result<(), String> {
    let dao = AiDao::try_new()?;
    dao.save_message(&message).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_update_rolling_summary(
    session_id: String,
    summary: String,
    archive_before: Option<String>,
) -> Result<(), String> {
    let dao = AiDao::try_new()?;
    dao.update_rolling_summary(&session_id, &summary, archive_before.as_deref()).map_err(|e| e.to_string())
}

// -------------------------------------------------------------
// 幂等性控制 Commands
// -------------------------------------------------------------

#[tauri::command]
pub async fn ai_check_or_init_idempotency(
    key: String,
    action_type: String,
    session_id: Option<String>,
    request_hash: String,
) -> Result<AiIdempotencyRecord, String> {
    let dao = AiDao::try_new()?;
    dao.check_or_init_idempotency(&key, &action_type, session_id.as_deref(), &request_hash).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_complete_idempotency(key: String, result_payload: String) -> Result<(), String> {
    let dao = AiDao::try_new()?;
    dao.complete_idempotency(&key, &result_payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_fail_idempotency(key: String, error_message: String) -> Result<(), String> {
    let dao = AiDao::try_new()?;
    dao.fail_idempotency(&key, &error_message).map_err(|e| e.to_string())
}

// -------------------------------------------------------------
// 工具审计 Commands
// -------------------------------------------------------------

#[tauri::command]
pub async fn ai_log_tool_audit(audit: AiToolAuditRecord) -> Result<(), String> {
    let dao = AiDao::try_new()?;
    dao.log_tool_audit(&audit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_get_tool_audits(session_id: String, limit: Option<i64>) -> Result<Vec<AiToolAuditRecord>, String> {
    let dao = AiDao::try_new()?;
    dao.get_tool_audits(&session_id, limit.unwrap_or(20)).map_err(|e| e.to_string())
}
