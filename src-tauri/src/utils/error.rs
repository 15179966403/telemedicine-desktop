// 错误处理工具

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum AppError {
    #[error("网络请求失败: {message}")]
    NetworkError { message: String },

    #[error("数据库操作失败: {message}")]
    DatabaseError { message: String },

    #[error("认证失败: {message}")]
    AuthError { message: String },

    #[error("验证失败: {message}")]
    ValidationError { message: String },

    #[error("文件操作失败: {message}")]
    FileError { message: String },

    #[error("权限不足: {message}")]
    PermissionError { message: String },

    #[error("未知错误: {message}")]
    UnknownError { message: String },
}

impl AppError {
    pub fn network_error(message: impl Into<String>) -> Self {
        Self::NetworkError {
            message: message.into(),
        }
    }

    pub fn database_error(message: impl Into<String>) -> Self {
        Self::DatabaseError {
            message: message.into(),
        }
    }

    pub fn auth_error(message: impl Into<String>) -> Self {
        Self::AuthError {
            message: message.into(),
        }
    }

    pub fn validation_error(message: impl Into<String>) -> Self {
        Self::ValidationError {
            message: message.into(),
        }
    }

    pub fn file_error(message: impl Into<String>) -> Self {
        Self::FileError {
            message: message.into(),
        }
    }

    pub fn permission_error(message: impl Into<String>) -> Self {
        Self::PermissionError {
            message: message.into(),
        }
    }

    pub fn unknown_error(message: impl Into<String>) -> Self {
        Self::UnknownError {
            message: message.into(),
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(self, AppError::NetworkError { .. })
    }

    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::NetworkError { .. } => "NETWORK_ERROR",
            AppError::DatabaseError { .. } => "DATABASE_ERROR",
            AppError::AuthError { .. } => "AUTH_ERROR",
            AppError::ValidationError { .. } => "VALIDATION_ERROR",
            AppError::FileError { .. } => "FILE_ERROR",
            AppError::PermissionError { .. } => "PERMISSION_ERROR",
            AppError::UnknownError { .. } => "UNKNOWN_ERROR",
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::database_error(err.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::network_error(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::file_error(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::validation_error(format!("JSON parsing error: {}", err))
    }
}

// 结果类型别名
pub type AppResult<T> = Result<T, AppError>;

// 错误处理宏
#[macro_export]
macro_rules! app_error {
    ($kind:ident, $msg:expr) => {
        AppError::$kind { message: $msg.to_string() }
    };
    ($kind:ident, $fmt:expr, $($arg:tt)*) => {
        AppError::$kind { message: format!($fmt, $($arg)*) }
    };
}