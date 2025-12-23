// 服务模块

pub mod auth;
pub mod patient;
pub mod message;
pub mod file;

pub use auth::*;
pub use patient::*;
pub use message::*;
pub use file::*;