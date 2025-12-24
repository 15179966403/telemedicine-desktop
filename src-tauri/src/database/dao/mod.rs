// 数据访问层模块

pub mod user_dao;
pub mod patient_dao;
pub mod consultation_dao;
pub mod message_dao;
pub mod medical_record_dao;
pub mod file_cache_dao;
pub mod audit_log_dao;

pub use user_dao::UserDao;
pub use patient_dao::PatientDao;
pub use consultation_dao::ConsultationDao;
pub use message_dao::MessageDao;
pub use medical_record_dao::MedicalRecordDao;
pub use file_cache_dao::FileCacheDao;
pub use audit_log_dao::AuditLogDao;

use rusqlite::Result;
use std::fmt::Debug;

// 通用DAO特征
pub trait BaseDao<T>
where
    T: Debug + Clone,
{
    fn create(&self, entity: &T) -> Result<String, String>;
    fn find_by_id(&self, id: &str) -> Result<Option<T>, String>;
    fn update(&self, entity: &T) -> Result<(), String>;
    fn delete(&self, id: &str) -> Result<(), String>;
    fn find_all(&self) -> Result<Vec<T>, String>;
}

// 分页查询结果
#[derive(Debug, Clone)]
pub struct PageResult<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

impl<T> PageResult<T> {
    pub fn new(items: Vec<T>, total: i64, page: i32, page_size: i32) -> Self {
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as i32;
        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
        }
    }
}

// 查询条件构建器
#[derive(Debug, Clone)]
pub struct QueryBuilder {
    pub conditions: Vec<String>,
    pub params: Vec<String>,
    pub order_by: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

impl QueryBuilder {
    pub fn new() -> Self {
        Self {
            conditions: Vec::new(),
            params: Vec::new(),
            order_by: None,
            limit: None,
            offset: None,
        }
    }

    pub fn add_condition(mut self, condition: &str, param: &str) -> Self {
        self.conditions.push(condition.to_string());
        self.params.push(param.to_string());
        self
    }

    pub fn order_by(mut self, order: &str) -> Self {
        self.order_by = Some(order.to_string());
        self
    }

    pub fn limit(mut self, limit: i32) -> Self {
        self.limit = Some(limit);
        self
    }

    pub fn offset(mut self, offset: i32) -> Self {
        self.offset = Some(offset);
        self
    }

    pub fn build_where_clause(&self) -> String {
        if self.conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", self.conditions.join(" AND "))
        }
    }

    pub fn build_order_clause(&self) -> String {
        self.order_by.as_ref()
            .map(|order| format!("ORDER BY {}", order))
            .unwrap_or_default()
    }

    pub fn build_limit_clause(&self) -> String {
        match (self.limit, self.offset) {
            (Some(limit), Some(offset)) => format!("LIMIT {} OFFSET {}", limit, offset),
            (Some(limit), None) => format!("LIMIT {}", limit),
            _ => String::new(),
        }
    }
}

impl Default for QueryBuilder {
    fn default() -> Self {
        Self::new()
    }
}