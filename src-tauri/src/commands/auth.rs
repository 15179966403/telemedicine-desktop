// 认证相关命令

use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct LoginCredentials {
    pub r#type: String, // "password" | "sms" | "realname"
    pub username: Option<String>,
    pub password: Option<String>,
    pub phone: Option<String>,
    pub sms_code: Option<String>,
    pub id_card: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResult {
    pub token: String,
    pub user: User,
    pub expires_at: String,
}

#[derive(Debug, Serialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub name: String,
    pub role: String,
    pub avatar: Option<String>,
    pub department: Option<String>,
    pub title: Option<String>,
}

#[tauri::command]
pub async fn auth_login(credentials: LoginCredentials) -> Result<AuthResult, String> {
    println!("Login attempt with credentials: {:?}", credentials);

    // TODO: 实现实际的认证逻辑
    // 这里先返回模拟数据

    // 模拟认证延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    // 简单的用户名密码验证（仅用于开发测试）
    if let (Some(username), Some(password)) = (&credentials.username, &credentials.password) {
        if username == "doctor" && password == "123456" {
            let user = User {
                id: "1".to_string(),
                username: username.clone(),
                name: "张医生".to_string(),
                role: "doctor".to_string(),
                avatar: None,
                department: Some("内科".to_string()),
                title: Some("主治医师".to_string()),
            };

            let auth_result = AuthResult {
                token: "mock-jwt-token".to_string(),
                user,
                expires_at: chrono::Utc::now()
                    .checked_add_signed(chrono::Duration::hours(8))
                    .unwrap()
                    .to_rfc3339(),
            };

            return Ok(auth_result);
        }
    }

    Err("用户名或密码错误".to_string())
}

#[tauri::command]
pub async fn auth_logout() -> Result<(), String> {
    println!("User logout");

    // TODO: 实现登出逻辑
    // 清除本地存储的认证信息等

    Ok(())
}

#[tauri::command]
pub async fn auth_refresh_token(current_token: String) -> Result<String, String> {
    println!("Refreshing token: {}", current_token);

    // TODO: 实现 token 刷新逻辑

    // 模拟刷新延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    if current_token == "mock-jwt-token" {
        Ok("new-mock-jwt-token".to_string())
    } else {
        Err("无效的 token".to_string())
    }
}

#[tauri::command]
pub async fn auth_validate_session(token: String) -> Result<bool, String> {
    println!("Validating session token: {}", token);

    // TODO: 实现会话验证逻辑

    // 模拟验证延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // 简单的 token 验证
    Ok(token == "mock-jwt-token" || token == "new-mock-jwt-token")
}