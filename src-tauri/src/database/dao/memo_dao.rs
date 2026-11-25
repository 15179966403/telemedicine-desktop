// 客户随访便签数据访问层 (MemoDao)
use crate::database::connection::{try_get_database, DbConnection};
use crate::models::{CustomerMemo, MemoImage};
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::sync::MutexGuard;

type DaoResult<T> = Result<T, Box<dyn std::error::Error>>;

/// 当前时间，精确到毫秒（前端按 ISO 格式解析展示）
pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub struct MemoDao {
    connection: DbConnection,
}

impl MemoDao {
    /// 使用全局数据库连接
    pub fn try_new() -> Result<Self, String> {
        let db = try_get_database()?;
        Ok(Self::with_connection(db.get_connection()))
    }

    /// 使用指定连接（单元测试使用）
    pub fn with_connection(connection: DbConnection) -> Self {
        Self { connection }
    }

    /// 数据库连接被其他线程持有时若发生过 panic，则不再使用该连接
    fn lock(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.connection
            .lock()
            .map_err(|_| "本地数据库连接异常，请重启应用后重试".to_string())
    }

    /// 读取便签文本；尚未记录过时返回 None
    pub fn get_memo(&self, customer_id: &str) -> DaoResult<Option<CustomerMemo>> {
        let conn = self.lock()?;
        Ok(read_memo(&conn, customer_id)?)
    }

    /// 新增或更新便签文本
    pub fn save_memo_content(&self, customer_id: &str, content: &str) -> DaoResult<CustomerMemo> {
        let conn = self.lock()?;
        let now = now_rfc3339();
        conn.execute(
            "INSERT INTO customer_memos (customer_id, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(customer_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at",
            params![customer_id, content, now],
        )?;
        Ok(read_memo(&conn, customer_id)?
            .unwrap_or(CustomerMemo {
                customer_id: customer_id.to_string(),
                content: content.to_string(),
                created_at: Some(now.clone()),
                updated_at: Some(now),
            }))
    }

    /// 未删除的照片列表，按添加顺序排列
    pub fn list_images(&self, customer_id: &str) -> DaoResult<Vec<MemoImage>> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM customer_memo_images
             WHERE customer_id = ?1 AND deleted_at IS NULL
             ORDER BY sort_order ASC, created_at ASC",
            IMAGE_COLUMNS
        ))?;
        let rows = stmt.query_map(params![customer_id], row_to_image)?;
        let mut images = Vec::new();
        for row in rows {
            images.push(row?);
        }
        Ok(images)
    }

    /// 按 ID 读取照片记录（包含已软删除的记录）
    pub fn get_image(&self, customer_id: &str, image_id: &str) -> DaoResult<Option<MemoImage>> {
        let conn = self.lock()?;
        Ok(conn
            .query_row(
                &format!(
                    "SELECT {} FROM customer_memo_images WHERE customer_id = ?1 AND id = ?2",
                    IMAGE_COLUMNS
                ),
                params![customer_id, image_id],
                row_to_image,
            )
            .optional()?)
    }

    /// 追加一张照片：排序号取该客户现有最大值加一，与插入记录在同一事务内完成
    pub fn append_image(&self, image: &mut MemoImage) -> DaoResult<()> {
        let conn = self.lock()?;
        let tx = conn.unchecked_transaction()?;
        let next_order: i64 = tx.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM customer_memo_images WHERE customer_id = ?1",
            params![image.customer_id],
            |row| row.get(0),
        )?;
        image.sort_order = next_order;

        tx.execute(
            "INSERT INTO customer_memo_images
                 (id, customer_id, file_name, stored_name, thumb_name, mime_type, file_size,
                  width, height, caption, record_date, sort_order, deleted_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                image.id,
                image.customer_id,
                image.file_name,
                image.stored_name,
                image.thumb_name,
                image.mime_type,
                image.file_size,
                image.width,
                image.height,
                image.caption,
                image.record_date,
                image.sort_order,
                image.deleted_at,
                image.created_at,
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// 软删除一张照片。返回 false 表示照片不存在或此前已删除
    pub fn soft_delete_image(&self, customer_id: &str, image_id: &str) -> DaoResult<bool> {
        let conn = self.lock()?;
        let deleted = conn.execute(
            "UPDATE customer_memo_images SET deleted_at = ?3
             WHERE customer_id = ?1 AND id = ?2 AND deleted_at IS NULL",
            params![customer_id, image_id, now_rfc3339()],
        )?;
        Ok(deleted > 0)
    }
}

const IMAGE_COLUMNS: &str = "id, customer_id, file_name, stored_name, thumb_name, mime_type, file_size, width, height, caption, record_date, sort_order, deleted_at, created_at";

fn read_memo(conn: &Connection, customer_id: &str) -> rusqlite::Result<Option<CustomerMemo>> {
    conn.query_row(
        "SELECT customer_id, content, created_at, updated_at FROM customer_memos WHERE customer_id = ?1",
        params![customer_id],
        |row| {
            Ok(CustomerMemo {
                customer_id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    )
    .optional()
}

fn row_to_image(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoImage> {
    Ok(MemoImage {
        id: row.get(0)?,
        customer_id: row.get(1)?,
        file_name: row.get(2)?,
        stored_name: row.get(3)?,
        thumb_name: row.get(4)?,
        mime_type: row.get(5)?,
        file_size: row.get(6)?,
        width: row.get(7)?,
        height: row.get(8)?,
        caption: row.get(9)?,
        record_date: row.get(10)?,
        sort_order: row.get(11)?,
        deleted_at: row.get(12)?,
        created_at: row.get(13)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::migrations::MigrationManager;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};
    use tempfile::tempdir;

    fn create_dao() -> MemoDao {
        let temp_dir = tempdir().unwrap();
        let conn = Connection::open(temp_dir.path().join("test.db")).unwrap();
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();
        MigrationManager::new().run_migrations(&conn).unwrap();
        MemoDao::with_connection(Arc::new(Mutex::new(conn)))
    }

    fn sample_image(id: &str, customer_id: &str) -> MemoImage {
        MemoImage {
            id: id.to_string(),
            customer_id: customer_id.to_string(),
            file_name: Some("微信图片.jpg".to_string()),
            stored_name: format!("{id}.jpg"),
            thumb_name: Some(format!("{id}_thumb.jpg")),
            mime_type: Some("image/jpeg".to_string()),
            file_size: 1024,
            width: Some(4000),
            height: Some(3000),
            caption: None,
            record_date: None,
            sort_order: 0,
            deleted_at: None,
            created_at: Some(now_rfc3339()),
        }
    }

    #[test]
    fn memo_text_is_created_then_updated() {
        let dao = create_dao();
        assert!(dao.get_memo("C001").unwrap().is_none());

        let created = dao.save_memo_content("C001", "第一次记录").unwrap();
        assert_eq!(created.content, "第一次记录");
        assert_eq!(dao.get_memo("C001").unwrap().unwrap().content, "第一次记录");

        let updated = dao.save_memo_content("C001", "第二次记录").unwrap();
        assert_eq!(updated.content, "第二次记录");
        assert_eq!(created.created_at, updated.created_at);
        assert_eq!(dao.get_memo("C001").unwrap().unwrap().content, "第二次记录");

        // 便签文本可以清空，且与其他客户互不影响
        dao.save_memo_content("C001", "").unwrap();
        assert_eq!(dao.get_memo("C001").unwrap().unwrap().content, "");
        assert!(dao.get_memo("C002").unwrap().is_none());
    }

    #[test]
    fn images_are_listed_in_added_order_and_per_customer() {
        let dao = create_dao();
        let mut a1 = sample_image("a1", "C001");
        let mut a2 = sample_image("a2", "C001");
        let mut b1 = sample_image("b1", "C002");
        dao.append_image(&mut a2).unwrap();
        dao.append_image(&mut a1).unwrap();
        dao.append_image(&mut b1).unwrap();

        // 排序号按追加顺序递增，与 ID 无关
        assert_eq!((a2.sort_order, a1.sort_order), (0, 1));

        let ids: Vec<String> = dao.list_images("C001").unwrap().into_iter().map(|i| i.id).collect();
        assert_eq!(ids, vec!["a2".to_string(), "a1".to_string()]);
        let other: Vec<String> = dao.list_images("C002").unwrap().into_iter().map(|i| i.id).collect();
        assert_eq!(other, vec!["b1".to_string()]);
    }

    #[test]
    fn soft_delete_hides_image_but_keeps_record() {
        let dao = create_dao();
        let mut image = sample_image("a1", "C001");
        dao.append_image(&mut image).unwrap();

        assert!(dao.soft_delete_image("C001", "a1").unwrap());
        // 只能删除一次；其他客户 ID 下查不到这条记录
        assert!(!dao.soft_delete_image("C001", "a1").unwrap());
        assert!(!dao.soft_delete_image("C002", "a1").unwrap());

        assert!(dao.list_images("C001").unwrap().is_empty());
        // 记录与文件名仍在，供后续恢复使用
        let stored = dao.get_image("C001", "a1").unwrap().unwrap();
        assert_eq!(stored.stored_name, "a1.jpg");
        assert_eq!(stored.thumb_name.as_deref(), Some("a1_thumb.jpg"));
        assert!(stored.deleted_at.is_some());
    }

    #[test]
    fn stored_fields_round_trip() {
        let dao = create_dao();
        let mut image = MemoImage {
            file_name: None,
            mime_type: Some("image/png".to_string()),
            width: None,
            height: None,
            ..sample_image("a1", "C001")
        };
        image.stored_name = "a1.png".to_string();
        dao.append_image(&mut image).unwrap();

        let loaded = dao.get_image("C001", "a1").unwrap().unwrap();
        assert_eq!(loaded.file_name, None);
        assert_eq!(loaded.mime_type.as_deref(), Some("image/png"));
        assert_eq!(loaded.width, None);
        assert_eq!(loaded.file_size, 1024);
        assert_eq!(loaded.created_at, image.created_at);
        assert_eq!(loaded.deleted_at, None);
    }
}
