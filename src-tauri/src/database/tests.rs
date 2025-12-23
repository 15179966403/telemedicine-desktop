// 数据库操作单元测试

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::migrations::MigrationManager;
    use crate::models::*;
    use tempfile::tempdir;
    use chrono::Utc;
    use std::sync::{Arc, Mutex};
    use rusqlite::Connection;

    // 创建测试数据库连接
    fn create_test_connection() -> Arc<Mutex<Connection>> {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let conn = Connection::open(&db_path).unwrap();

        // 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

        // 运行迁移
        let migration_manager = MigrationManager::new();
        migration_manager.run_migrations(&conn).unwrap();

        Arc::new(Mutex::new(conn))
    }

    // 迁移测试
    mod migration_tests {
        use super::*;

        #[test]
        fn test_migration_execution() {
            let temp_dir = tempdir().unwrap();
            let db_path = temp_dir.path().join("test.db");
            let conn = Connection::open(&db_path).unwrap();

            let migration_manager = MigrationManager::new();
            let result = migration_manager.run_migrations(&conn);
            assert!(result.is_ok());

            // 验证表是否创建
            let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").unwrap();
            let table_names: Vec<String> = stmt.query_map([], |row| {
                Ok(row.get::<_, String>(0)?)
            }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();

            assert!(table_names.contains(&"users".to_string()));
            assert!(table_names.contains(&"patients".to_string()));
            assert!(table_names.contains(&"consultations".to_string()));
            assert!(table_names.contains(&"messages".to_string()));
            assert!(table_names.contains(&"medical_records".to_string()));
            assert!(table_names.contains(&"file_cache".to_string()));
            assert!(table_names.contains(&"audit_logs".to_string()));
        }
    }

    // 基础数据库操作测试
    mod basic_operations_tests {
        use super::*;

        #[test]
        fn test_database_connection() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            // 测试基本查询
            let mut stmt = conn.prepare("SELECT 1").unwrap();
            let result: i32 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(result, 1);
        }

        #[test]
        fn test_table_creation() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            // 验证所有表都已创建
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").unwrap();
            let table_count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert!(table_count >= 7); // 至少应该有7个表
        }

        #[test]
        fn test_foreign_key_constraints() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            // 验证外键约束已启用
            let mut stmt = conn.prepare("PRAGMA foreign_keys").unwrap();
            let foreign_keys_enabled: i32 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(foreign_keys_enabled, 1);
        }
    }

    // 简单的CRUD测试
    mod crud_tests {
        use super::*;

        #[test]
        fn test_user_table_operations() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            // 插入用户
            let user_id = "test-user-1";
            let username = "test_user";
            let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

            conn.execute(
                "INSERT INTO users (id, username, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                [user_id, username, &now, &now],
            ).unwrap();

            // 查询用户
            let mut stmt = conn.prepare("SELECT username FROM users WHERE id = ?1").unwrap();
            let found_username: String = stmt.query_row([user_id], |row| row.get(0)).unwrap();
            assert_eq!(found_username, username);

            // 更新用户
            let new_username = "updated_user";
            conn.execute(
                "UPDATE users SET username = ?1, updated_at = ?2 WHERE id = ?3",
                [new_username, &now, user_id],
            ).unwrap();

            // 验证更新
            let mut stmt = conn.prepare("SELECT username FROM users WHERE id = ?1").unwrap();
            let updated_username: String = stmt.query_row([user_id], |row| row.get(0)).unwrap();
            assert_eq!(updated_username, new_username);

            // 删除用户
            conn.execute("DELETE FROM users WHERE id = ?1", [user_id]).unwrap();

            // 验证删除
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM users WHERE id = ?1").unwrap();
            let count: i32 = stmt.query_row([user_id], |row| row.get(0)).unwrap();
            assert_eq!(count, 0);
        }

        #[test]
        fn test_patient_table_operations() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            // 插入患者
            let patient_id = "test-patient-1";
            let patient_name = "张三";
            let age = 30;
            let gender = "male";
            let phone = "13800138000";
            let tags = r#"["高血压", "糖尿病"]"#;
            let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

            conn.execute(
                "INSERT INTO patients (id, name, age, gender, phone, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                [patient_id, patient_name, &age.to_string(), gender, phone, tags, &now, &now],
            ).unwrap();

            // 查询患者
            let mut stmt = conn.prepare("SELECT name, age, gender FROM patients WHERE id = ?1").unwrap();
            let (found_name, found_age, found_gender): (String, i32, String) = stmt.query_row([patient_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            }).unwrap();

            assert_eq!(found_name, patient_name);
            assert_eq!(found_age, age);
            assert_eq!(found_gender, gender);

            // 按姓名搜索
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM patients WHERE name LIKE ?1").unwrap();
            let count: i32 = stmt.query_row(["%张%"], |row| row.get(0)).unwrap();
            assert_eq!(count, 1);
        }

        #[test]
        fn test_consultation_table_operations() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            // 先插入患者（外键依赖）
            let patient_id = "test-patient-1";
            let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            conn.execute(
                "INSERT INTO patients (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                [patient_id, "测试患者", &now, &now],
            ).unwrap();

            // 插入问诊
            let consultation_id = "test-consultation-1";
            let doctor_id = "doctor-1";
            let status = "pending";
            let consultation_type = "text";

            conn.execute(
                "INSERT INTO consultations (id, patient_id, doctor_id, status, consultation_type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                [consultation_id, patient_id, doctor_id, status, consultation_type, &now, &now],
            ).unwrap();

            // 查询问诊
            let mut stmt = conn.prepare("SELECT status, consultation_type FROM consultations WHERE id = ?1").unwrap();
            let (found_status, found_type): (String, String) = stmt.query_row([consultation_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            }).unwrap();

            assert_eq!(found_status, status);
            assert_eq!(found_type, consultation_type);

            // 按状态查询
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM consultations WHERE status = ?1").unwrap();
            let count: i32 = stmt.query_row([status], |row| row.get(0)).unwrap();
            assert_eq!(count, 1);
        }
    }

    // 性能测试
    mod performance_tests {
        use super::*;

        #[test]
        fn test_bulk_insert_performance() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();

            let start = std::time::Instant::now();
            let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

            // 批量插入100个患者
            for i in 0..100 {
                let patient_id = format!("patient-{}", i);
                let patient_name = format!("患者{}", i);
                let age = 20 + (i % 60);
                let gender = if i % 2 == 0 { "male" } else { "female" };
                let phone = format!("1380013{:04}", i);

                conn.execute(
                    "INSERT INTO patients (id, name, age, gender, phone, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    [&patient_id, &patient_name, &age.to_string(), gender, &phone, "[]", &now, &now],
                ).unwrap();
            }

            let duration = start.elapsed();
            println!("批量插入100个患者耗时: {:?}", duration);

            // 验证插入成功
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM patients").unwrap();
            let count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 100);
        }

        #[test]
        fn test_search_performance() {
            let connection = create_test_connection();
            let conn = connection.lock().unwrap();
            let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

            // 先插入一些测试数据
            for i in 0..50 {
                let patient_id = format!("patient-{}", i);
                let patient_name = format!("张{}", i);
                let age = 20 + (i % 60);
                let phone = format!("1380013{:04}", i);

                conn.execute(
                    "INSERT INTO patients (id, name, age, gender, phone, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    [&patient_id, &patient_name, &age.to_string(), "male", &phone, "[]", &now, &now],
                ).unwrap();
            }

            let start = std::time::Instant::now();
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM patients WHERE name LIKE ?1").unwrap();
            let count: i32 = stmt.query_row(["%张%"], |row| row.get(0)).unwrap();
            let duration = start.elapsed();

            println!("搜索患者耗时: {:?}", duration);
            assert!(count > 0);
            assert!(duration.as_millis() < 100); // 搜索应该在100ms内完成
        }
    }
}