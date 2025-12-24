// Tauri 命令模块

pub mod auth;
pub mod patient;
pub mod message;
pub mod window;
pub mod database;
pub mod file;
pub mod websocket;
pub mod security;

// 重新导出所有命令
pub use auth::*;
pub use patient::*;
pub use message::*;
pub use window::*;
pub use database::*;
pub use file::*;
pub use websocket::*;
pub use security::*;