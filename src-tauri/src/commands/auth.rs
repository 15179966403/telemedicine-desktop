// 认证相关命令

use serde::{Deserialize, Serialize};
use crate::services::AuthService;
use crate::models::{User, LoginCredentials, AuthResult};
use crate::utils::error::AppError;
use crate::database::dao::BaseDao;

#[tauri::command]
pub async fn auth_login(credentials: LoginCredentials) -> Result<AuthResult, String> {
    println!("Login attempt with credentials: {:?}", credentials);

    let auth_service = AuthService::new();

    match auth_service.authenticate(credentials).await {
        Ok(result) => Ok(result),
        Err(e) => {
            eprintln!("Authentication failed: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn auth_logout(token: Option<String>) -> Result<(), String> {
    println!("User logout");

    let auth_service = AuthService::new();

    if let Some(token) = token {
        match auth_service.logout(&token).await {
            Ok(_) => Ok(()),
            Err(e) => {
                eprintln!("Logout failed: {}", e);
                // 即使登出失败也返回成功，因为前端需要清除状态
                Ok(())
            }
        }
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn auth_refresh_token(current_token: String) -> Result<String, String> {
    println!("Refreshing token: {}", current_token);

    let auth_service = AuthService::new();

    match auth_service.refresh_token(&current_token).await {
        Ok(new_token) => Ok(new_token),
        Err(e) => {
            eprintln!("Token refresh failed: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn auth_validate_session(token: String) -> Result<bool, String> {
    println!("Validating session token: {}", token);

    let auth_service = AuthService::new();

    match auth_service.validate_token(&token).await {
        Ok(is_valid) => Ok(is_valid),
        Err(e) => {
            eprintln!("Session validation failed: {}", e);
            Ok(false) // 验证失败时返回 false 而不是错误
        }
    }
}

#[tauri::command]
pub async fn auth_save_session(
    token: String,
    user: serde_json::Value,
    expires_at: String,
) -> Result<(), String> {
    println!("Saving session to native SQLite: {:?}", user);

    let user_id = if let Some(id_str) = user["id"].as_str() {
        id_str.to_string()
    } else if let Some(id_num) = user["id"].as_i64() {
        id_num.to_string()
    } else if let Some(uid_num) = user["userId"].as_i64() {
        uid_num.to_string()
    } else if let Some(uid_str) = user["userId"].as_str() {
        uid_str.to_string()
    } else {
        "user-0".to_string()
    };

    let username = user["username"].as_str().unwrap_or("").to_string();
    let expires = chrono::DateTime::parse_from_rfc3339(&expires_at)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now() + chrono::Duration::hours(8));

    let user_dao = crate::database::dao::UserDao::new();
    match user_dao.find_by_id(&user_id) {
        Ok(Some(_)) => {
            if let Err(e) = user_dao.update_token(&user_id, &token, expires) {
                eprintln!("Failed to update SQLite user token: {}", e);
            }
        }
        _ => {
            let new_user = crate::models::User {
                id: user_id.clone(),
                username,
                encrypted_token: Some(token),
                last_login: Some(chrono::Utc::now()),
                session_expires: Some(expires),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            };
            if let Err(e) = user_dao.create(&new_user) {
                eprintln!("Failed to create user in SQLite: {}", e);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{LoginCredentials, LoginType};

    #[tokio::test]
    async fn test_password_login_success() {
        let credentials = LoginCredentials {
            login_type: LoginType::Password,
            username: Some("doctor".to_string()),
            password: Some("123456".to_string()),
            phone: None,
            sms_code: None,
            id_card: None,
        };

        let result = auth_login(credentials).await;
        assert!(result.is_ok());

        let auth_result = result.unwrap();
        assert!(!auth_result.token.is_empty());
        assert_eq!(auth_result.user["username"], "doctor");
        assert_eq!(auth_result.user["name"], "张医生");
    }

    #[tokio::test]
    async fn test_password_login_failure() {
        let credentials = LoginCredentials {
            login_type: LoginType::Password,
            username: Some("wrong".to_string()),
            password: Some("wrong".to_string()),
            phone: None,
            sms_code: None,
            id_card: None,
        };

        let result = auth_login(credentials).await;
        assert!(result.is_err());
    }
}
