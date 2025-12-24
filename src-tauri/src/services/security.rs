// 安全服务模块

use crate::utils::CryptoService;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// 操作日志类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditAction {
    Login,
    Logout,
    ViewPatient,
    UpdatePatient,
    SendMessage,
    UploadFile,
    DownloadFile,
    AccessSensitiveData,
    ChangeSettings,
    DeleteData,
}

/// 操作日志记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub user_id: String,
    pub action: AuditAction,
    pub resource_type: Option<String>,
    pub resource_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub status: String, // "success" or "failed"
    pub error_message: Option<String>,
    pub metadata: HashMap<String, String>,
    pub timestamp: DateTime<Utc>,
}

/// 异常访问类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnomalyType {
    MultipleFailedLogins,
    UnusualAccessPattern,
    SuspiciousFileAccess,
    RapidDataAccess,
    UnauthorizedAccess,
}

/// 异常访问记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyRecord {
    pub id: String,
    pub user_id: String,
    pub anomaly_type: AnomalyType,
    pub severity: String, // "low", "medium", "high", "critical"
    pub description: String,
    pub detected_at: DateTime<Utc>,
    pub resolved: bool,
}

/// 会话活动跟踪
#[derive(Debug, Clone)]
struct SessionActivity {
    last_activity: DateTime<Utc>,
    failed_login_attempts: u32,
    access_count: u32,
    last_access_times: Vec<DateTime<Utc>>,
}

/// 安全服务
pub struct SecurityService {
    crypto: CryptoService,
    audit_logs: Arc<Mutex<Vec<AuditLog>>>,
    anomaly_records: Arc<Mutex<Vec<AnomalyRecord>>>,
    session_activities: Arc<Mutex<HashMap<String, SessionActivity>>>,
    auto_lock_timeout: u64, // 秒
}

impl SecurityService {
    pub fn new(auto_lock_timeout: u64) -> Self {
        Self {
            crypto: CryptoService::new(),
            audit_logs: Arc::new(Mutex::new(Vec::new())),
            anomaly_records: Arc::new(Mutex::new(Vec::new())),
            session_activities: Arc::new(Mutex::new(HashMap::new())),
            auto_lock_timeout,
        }
    }

    /// 加密敏感数据
    pub fn encrypt_sensitive_data(&self, data: &str) -> Result<String> {
        self.crypto.encrypt_string(data)
    }

    /// 解密敏感数据
    pub fn decrypt_sensitive_data(&self, encrypted_data: &str) -> Result<String> {
        self.crypto.decrypt_string(encrypted_data)
    }

    /// 记录操作日志
    pub async fn log_audit(
        &self,
        user_id: String,
        action: AuditAction,
        resource_type: Option<String>,
        resource_id: Option<String>,
        status: String,
        error_message: Option<String>,
        metadata: HashMap<String, String>,
    ) -> Result<String> {
        let log = AuditLog {
            id: uuid::Uuid::new_v4().to_string(),
            user_id: user_id.clone(),
            action,
            resource_type,
            resource_id,
            ip_address: None,
            user_agent: None,
            status,
            error_message,
            metadata,
            timestamp: Utc::now(),
        };

        let log_id = log.id.clone();
        let mut logs = self.audit_logs.lock().await;
        logs.push(log);

        // 更新会话活动
        self.update_session_activity(&user_id).await;

        Ok(log_id)
    }

    /// 获取操作日志
    pub async fn get_audit_logs(
        &self,
        user_id: Option<String>,
        action: Option<AuditAction>,
        start_time: Option<DateTime<Utc>>,
        end_time: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Result<Vec<AuditLog>> {
        let logs = self.audit_logs.lock().await;
        let mut filtered: Vec<AuditLog> = logs
            .iter()
            .filter(|log| {
                if let Some(ref uid) = user_id {
                    if &log.user_id != uid {
                        return false;
                    }
                }
                if let Some(ref act) = action {
                    if !matches_action(&log.action, act) {
                        return false;
                    }
                }
                if let Some(start) = start_time {
                    if log.timestamp < start {
                        return false;
                    }
                }
                if let Some(end) = end_time {
                    if log.timestamp > end {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();

        filtered.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        filtered.truncate(limit);

        Ok(filtered)
    }

    /// 检测异常访问
    pub async fn detect_anomalies(&self, user_id: &str) -> Result<Vec<AnomalyRecord>> {
        let mut anomalies = Vec::new();
        let activities = self.session_activities.lock().await;

        if let Some(activity) = activities.get(user_id) {
            // 检测多次登录失败
            if activity.failed_login_attempts >= 3 {
                anomalies.push(AnomalyRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    user_id: user_id.to_string(),
                    anomaly_type: AnomalyType::MultipleFailedLogins,
                    severity: if activity.failed_login_attempts >= 5 {
                        "high".to_string()
                    } else {
                        "medium".to_string()
                    },
                    description: format!(
                        "检测到 {} 次连续登录失败",
                        activity.failed_login_attempts
                    ),
                    detected_at: Utc::now(),
                    resolved: false,
                });
            }

            // 检测快速数据访问（1分钟内超过50次访问）
            let one_minute_ago = Utc::now() - chrono::Duration::minutes(1);
            let recent_accesses = activity
                .last_access_times
                .iter()
                .filter(|t| **t > one_minute_ago)
                .count();

            if recent_accesses > 50 {
                anomalies.push(AnomalyRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    user_id: user_id.to_string(),
                    anomaly_type: AnomalyType::RapidDataAccess,
                    severity: "high".to_string(),
                    description: format!("检测到异常高频访问：1分钟内 {} 次访问", recent_accesses),
                    detected_at: Utc::now(),
                    resolved: false,
                });
            }
        }

        // 保存异常记录
        if !anomalies.is_empty() {
            let mut records = self.anomaly_records.lock().await;
            records.extend(anomalies.clone());
        }

        Ok(anomalies)
    }

    /// 记录登录失败
    pub async fn record_failed_login(&self, user_id: &str) {
        let mut activities = self.session_activities.lock().await;
        let activity = activities.entry(user_id.to_string()).or_insert(SessionActivity {
            last_activity: Utc::now(),
            failed_login_attempts: 0,
            access_count: 0,
            last_access_times: Vec::new(),
        });

        activity.failed_login_attempts += 1;
        activity.last_activity = Utc::now();
    }

    /// 重置登录失败计数
    pub async fn reset_failed_login(&self, user_id: &str) {
        let mut activities = self.session_activities.lock().await;
        if let Some(activity) = activities.get_mut(user_id) {
            activity.failed_login_attempts = 0;
        }
    }

    /// 更新会话活动
    async fn update_session_activity(&self, user_id: &str) {
        let mut activities = self.session_activities.lock().await;
        let activity = activities.entry(user_id.to_string()).or_insert(SessionActivity {
            last_activity: Utc::now(),
            failed_login_attempts: 0,
            access_count: 0,
            last_access_times: Vec::new(),
        });

        activity.last_activity = Utc::now();
        activity.access_count += 1;
        activity.last_access_times.push(Utc::now());

        // 只保留最近100次访问记录
        if activity.last_access_times.len() > 100 {
            activity.last_access_times.drain(0..50);
        }
    }

    /// 检查是否需要自动锁屏
    pub async fn should_auto_lock(&self, user_id: &str) -> bool {
        let activities = self.session_activities.lock().await;
        if let Some(activity) = activities.get(user_id) {
            let elapsed = Utc::now()
                .signed_duration_since(activity.last_activity)
                .num_seconds();
            return elapsed as u64 >= self.auto_lock_timeout;
        }
        false
    }

    /// 获取最后活动时间
    pub async fn get_last_activity(&self, user_id: &str) -> Option<DateTime<Utc>> {
        let activities = self.session_activities.lock().await;
        activities.get(user_id).map(|a| a.last_activity)
    }

    /// 获取异常记录
    pub async fn get_anomaly_records(
        &self,
        user_id: Option<String>,
        resolved: Option<bool>,
    ) -> Result<Vec<AnomalyRecord>> {
        let records = self.anomaly_records.lock().await;
        let filtered: Vec<AnomalyRecord> = records
            .iter()
            .filter(|record| {
                if let Some(ref uid) = user_id {
                    if &record.user_id != uid {
                        return false;
                    }
                }
                if let Some(res) = resolved {
                    if record.resolved != res {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();

        Ok(filtered)
    }

    /// 标记异常已解决
    pub async fn resolve_anomaly(&self, anomaly_id: &str) -> Result<()> {
        let mut records = self.anomaly_records.lock().await;
        if let Some(record) = records.iter_mut().find(|r| r.id == anomaly_id) {
            record.resolved = true;
        }
        Ok(())
    }

    /// 清理旧的日志和记录
    pub async fn cleanup_old_records(&self, days: i64) -> Result<()> {
        let cutoff = Utc::now() - chrono::Duration::days(days);

        let mut logs = self.audit_logs.lock().await;
        logs.retain(|log| log.timestamp > cutoff);

        let mut records = self.anomaly_records.lock().await;
        records.retain(|record| record.detected_at > cutoff);

        Ok(())
    }
}

fn matches_action(a: &AuditAction, b: &AuditAction) -> bool {
    std::mem::discriminant(a) == std::mem::discriminant(b)
}

#[cfg(test)]
mod tests;

