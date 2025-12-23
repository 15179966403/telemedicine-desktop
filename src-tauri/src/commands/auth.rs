// 认证相关命令

use serde::{Deserialize, Serialize};
use crate::services::AuthService;
use crate::models::{User, LoginCredentials, AuthResult};
use crate::utils::error::AppError;

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
            username: Some("doctor".to_string()),
            password: Some("wrong_password".to_string()),
            phone: None,
            sms_code: None,
            id_card: None,
        };

        let result = auth_login(credentials).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "用户名或密码错误");
    }

    #[tokio::test]
    async fn test_logout_success() {
        let token = Some("some_token".to_string());

        let logout_result = auth_logout(token).await;
        assert!(logout_result.is_ok());
    }
}