// 数据库模块

pub mod connection;
pub mod migrations;
pub mod dao;
pub mod query_optimizer;

#[cfg(test)]
mod tests;

pub use connection::{init_database, get_database, DatabaseManager, DatabaseStats};
pub use migrations::MigrationManager;
pub use dao::*;
pub use query_optimizer::{QueryOptimizer, QueryCache, BatchOperations, IndexAdvisor};