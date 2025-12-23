// 用户数据访问层

use crate::database::connection::{get_database, DbConnection};
use crate::database::dao::{BaseDao, QueryBuilder};
use crate::models::User;
use rusqlite::{params, Result};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct UserDao {
    connection: DbConnection,
}

impl UserDao {
    pub fn new() -> Self {
        Self {
            connection: get_database().get_connection(),
        }
    }

    pub fn find_by_username(&self, username: &str) -> Result<Option<User>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, username, encrypted_token, last_login, session_expires, created_at, updated_at
             FROM users WHERE username = ?1"
        )?;

        let user_result = stmt.query_row(params![username], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                encrypted_token: row.get(2)?,
                last_login: row.get(3)?,
                session_expires: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        });

        match user_result {
            Ok(user) => Ok(Some(user)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub fn update_token(&self, user_id: &str, encrypted_token: &str, expires: DateTime<Utc>) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE users SET encrypted_token = ?1, session_expires = ?2, last_login = ?3, updated_at = ?4 WHERE id = ?5",
            params![encrypted_token, expires, now, now, user_id],
        )?;

        Ok(())
    }

    pub fn clear_token(&self, user_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE users SET encrypted_token = NULL, session_expires = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, user_id],
        )?;

        Ok(())
    }

    pub fn is_session_valid(&self, user_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT session_expires FROM users WHERE id = ?1 AND encrypted_token IS NOT NULL"
        )?;

        let expires_result = stmt.query_row(params![user_id], |row| {
            let expires: Option<DateTime<Utc>> = row.get(0)?;
            Ok(expires)
        });

        match expires_result {
            Ok(Some(expires)) => Ok(expires > Utc::now()),
            Ok(None) => Ok(false),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(e) => Err(Box::new(e)),
        }
    }
}

impl BaseDao<User> for UserDao {
    fn create(&self, user: &User) -> Result<String, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        conn.execute(
            "INSERT INTO users (id, username, encrypted_token, last_login, session_expires, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                user.username,
                user.encrypted_token,
                user.last_login,
                user.session_expires,
                now,
                now
            ],
        )?;

        Ok(id)
    }

    fn find_by_id(&self, id: &str) -> Result<Option<User>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, username, encrypted_token, last_login, session_expires, created_at, updated_at
             FROM users WHERE id = ?1"
        )?;

        let user_result = stmt.query_row(params![id], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                encrypted_token: row.get(2)?,
                last_login: row.get(3)?,
                session_expires: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        });

        match user_result {
            Ok(user) => Ok(Some(user)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    fn update(&self, user: &User) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "UPDATE users SET username = ?1, encrypted_token = ?2, last_login = ?3, session_expires = ?4, updated_at = ?5
             WHERE id = ?6",
            params![
                user.username,
                user.encrypted_token,
                user.last_login,
                user.session_expires,
                now,
                user.id
            ],
        )?;

        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        conn.execute("DELETE FROM users WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn find_all(&self) -> Result<Vec<User>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, username, encrypted_token, last_login, session_expires, created_at, updated_at
             FROM users ORDER BY created_at DESC"
        )?;

        let user_iter = stmt.query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                encrypted_token: row.get(2)?,
                last_login: row.get(3)?,
                session_expires: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut users = Vec::new();
        for user in user_iter {
            users.push(user?);
        }

        Ok(users)
    }
}

impl Default for UserDao {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use tempfile::tempdir;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    fn create_test_dao() -> UserDao {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // 创建测试表
        conn.execute(
            "CREATE TABLE users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                encrypted_token TEXT,
                last_login DATETIME,
                session_expires DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).unwrap();

        UserDao {
            connection: Arc::new(Mutex::new(conn)),
        }
    }

    #[test]
    fn test_create_user() {
        let dao = create_test_dao();
        let user = User {
            id: "test-id".to_string(),
            username: "test_user".to_string(),
            encrypted_token: None,
            last_login: None,
            session_expires: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let result = dao.create(&user);
        assert!(result.is_ok());
    }

    #[test]
    fn test_find_by_username() {
        let dao = create_test_dao();
        let user = User {
            id: "test-id".to_string(),
            username: "test_user".to_string(),
            encrypted_token: None,
            last_login: None,
            session_expires: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        dao.create(&user).unwrap();
        let found_user = dao.find_by_username("test_user").unwrap();
        assert!(found_user.is_some());
        assert_eq!(found_user.unwrap().username, "test_user");
    }
}