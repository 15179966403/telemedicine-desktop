// 认证服务

use crate::models::{User, AuthSession, LoginCredentials, AuthResult, LoginType};
use crate::utils::{crypto::CryptoService, error::AppError};
use anyhow::Result;
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
struct JwtClaims {
    sub: String,      // 用户ID
    username: String, // 用户名
    exp: i64,        // 过期时间
    iat: i64,        // 签发时间
    role: String,    // 用户角色
}

pub struct AuthService {
    crypto_service: CryptoService,
    // 在实际应用中，这些应该存储在数据库中
    sessions: HashMap<String, AuthSession>,
}

impl AuthService {
    pub fn new() -> Self {
        Self {
            crypto_service: CryptoService::new(),
            sessions: HashMap::new(),
        }
    }

    pub async fn authenticate(&self, credentials: LoginCredentials) -> Result<AuthResult> {
        match credentials.login_type {
            LoginType::Password => {
                self.authenticate_password(
                    credentials.username.as_deref().unwrap_or(""),
                    credentials.password.as_deref().unwrap_or(""),
                ).await
            }
            LoginType::Sms => {
                self.authenticate_sms(
                    credentials.phone.as_deref().unwrap_or(""),
                    credentials.sms_code.as_deref().unwrap_or(""),
                ).await
            }
            LoginType::Realname => {
                self.authenticate_realname(
                    credentials.id_card.as_deref().unwrap_or(""),
                ).await
            }
        }
    }

    async fn authenticate_password(&self, username: &str, password: &str) -> Result<AuthResult> {
        // 模拟认证延迟
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        // 简单的用户名密码验证（仅用于开发测试）
        if username == "doctor" && password == "123456" {
            let user_id = "1".to_string();
            let token = self.generate_jwt_token(&user_id, username, "doctor")?;
            let expires_at = Utc::now() + Duration::hours(8);

            let user = User {
                id: user_id.clone(),
                username: username.to_string(),
                encrypted_token: Some(token.clone()),
                last_login: Some(Utc::now()),
                session_expires: Some(expires_at),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            Ok(AuthResult {
                token,
                user: serde_json::json!({
                    "id": user.id,
                    "username": user.username,
                    "name": "张医生",
                    "role": "doctor",
                    "department": "内科",
                    "title": "主治医师"
                }),
                expires_at: expires_at.to_rfc3339(),
            })
        } else {
            Err(anyhow::anyhow!("用户名或密码错误"))
        }
    }

    async fn authenticate_sms(&self, phone: &str, sms_code: &str) -> Result<AuthResult> {
        // 模拟短信验证
        tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

        // 简单的验证码验证（仅用于开发测试）
        if phone == "13800138000" && sms_code == "123456" {
            let user_id = "2".to_string();
            let username = format!("user_{}", &phone[7..]);
            let token = self.generate_jwt_token(&user_id, &username, "doctor")?;
            let expires_at = Utc::now() + Duration::hours(8);

            Ok(AuthResult {
                token,
                user: serde_json::json!({
                    "id": user_id,
                    "username": username,
                    "name": "李医生",
                    "role": "doctor",
                    "department": "外科",
                    "title": "副主任医师"
                }),
                expires_at: expires_at.to_rfc3339(),
            })
        } else {
            Err(anyhow::anyhow!("手机号或验证码错误"))
        }
    }

    async fn authenticate_realname(&self, id_card: &str) -> Result<AuthResult> {
        // 模拟实名认证
        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

        // 简单的身份证验证（仅用于开发测试）
        if id_card.len() == 18 {
            let user_id = "3".to_string();
            let username = format!("realname_{}", &id_card[14..18]);
            let token = self.generate_jwt_token(&user_id, &username, "doctor")?;
            let expires_at = Utc::now() + Duration::hours(8);

            Ok(AuthResult {
                token,
                user: serde_json::json!({
                    "id": user_id,
                    "username": username,
                    "name": "王医生",
                    "role": "doctor",
                    "department": "儿科",
                    "title": "主任医师"
                }),
                expires_at: expires_at.to_rfc3339(),
            })
        } else {
            Err(anyhow::anyhow!("身份证号格式错误"))
        }
    }

    pub async fn validate_token(&self, token: &str) -> Result<bool> {
        // 模拟验证延迟
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        match self.decode_jwt_token(token) {
            Ok(claims) => {
                let now = Utc::now().timestamp();
                Ok(claims.exp > now)
            }
            Err(_) => Ok(false),
        }
    }

    pub async fn refresh_token(&self, current_token: &str) -> Result<String> {
        // 模拟刷新延迟
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        let claims = self.decode_jwt_token(current_token)?;

        // 检查 token 是否即将过期（1小时内）
        let now = Utc::now().timestamp();
        if claims.exp - now > 3600 {
            return Err(anyhow::anyhow!("Token 尚未到刷新时间"));
        }

        // 生成新的 token
        let new_token = self.generate_jwt_token(&claims.sub, &claims.username, &claims.role)?;
        Ok(new_token)
    }

    pub async fn logout(&self, token: &str) -> Result<()> {
        // TODO: 在实际应用中，应该将 token 加入黑名单
        println!("User logged out with token: {}", token);
        Ok(())
    }

    fn generate_jwt_token(&self, user_id: &str, username: &str, role: &str) -> Result<String> {
        let now = Utc::now();
        let claims = JwtClaims {
            sub: user_id.to_string(),
            username: username.to_string(),
            exp: (now + Duration::hours(8)).timestamp(),
            iat: now.timestamp(),
            role: role.to_string(),
        };

        // 在实际应用中，应该使用真正的 JWT 库
        // 这里使用简单的 base64 编码作为模拟
        let claims_json = serde_json::to_string(&claims)?;
        let encoded = base64::encode(claims_json);
        Ok(format!("jwt.{}", encoded))
    }

    fn decode_jwt_token(&self, token: &str) -> Result<JwtClaims> {
        if !token.starts_with("jwt.") {
            return Err(anyhow::anyhow!("Invalid token format"));
        }

        let encoded = &token[4..];
        let decoded = base64::decode(encoded)?;
        let claims_json = String::from_utf8(decoded)?;
        let claims: JwtClaims = serde_json::from_str(&claims_json)?;

        Ok(claims)
    }
}