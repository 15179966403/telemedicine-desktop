// 客户随访便签（医生本地标记）数据模型
//
// 便签文本存放在本地数据库；照片文件保存在便签照片库目录，数据库里只有元数据。

use serde::{Deserialize, Serialize};

/// 便签文本，每个客户一条
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerMemo {
    pub customer_id: String,
    pub content: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// 便签照片元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoImage {
    pub id: String,
    pub customer_id: String,
    pub file_name: Option<String>,
    pub stored_name: String,
    pub thumb_name: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub caption: Option<String>,
    pub record_date: Option<String>,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub created_at: Option<String>,
}

/// 打开便签时一次性返回的完整数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerMemoData {
    pub customer_id: String,
    pub content: String,
    pub updated_at: Option<String>,
    pub images: Vec<MemoImage>,
    /// 便签照片库根目录（便于医生或技术支持定位、迁移）
    pub storage_root_path: String,
    /// 照片库当前是否可用（磁盘未连接、不可写时为 false，此时便签文本仍可正常使用）
    pub storage_available: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 前端类型（src/types/memo.ts）按 camelCase 读取这些字段，字段名不能变
    #[test]
    fn json_field_names_match_the_frontend_types() {
        let data = CustomerMemoData {
            customer_id: "123".to_string(),
            content: "随访要点".to_string(),
            updated_at: None,
            images: vec![MemoImage {
                id: "a1".to_string(),
                customer_id: "123".to_string(),
                file_name: None,
                stored_name: "a1.jpg".to_string(),
                thumb_name: Some("a1_thumb.jpg".to_string()),
                mime_type: Some("image/jpeg".to_string()),
                file_size: 10,
                width: None,
                height: None,
                caption: None,
                record_date: None,
                sort_order: 0,
                deleted_at: None,
                created_at: None,
            }],
            storage_root_path: "D:\\健康管理便签照片库".to_string(),
            storage_available: true,
        };

        let json = serde_json::to_value(&data).unwrap();
        let keys = |value: &serde_json::Value| -> Vec<String> {
            let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
            keys.sort();
            keys
        };

        let mut expected_top = vec!["customerId", "content", "updatedAt", "images", "storageRootPath", "storageAvailable"]
            .iter().map(|k| k.to_string()).collect::<Vec<_>>();
        expected_top.sort();
        assert_eq!(keys(&json), expected_top);

        let mut expected_image = vec!["id", "customerId", "fileName", "storedName", "thumbName", "mimeType", "fileSize", "width", "height", "caption", "recordDate", "sortOrder", "deletedAt", "createdAt"]
            .iter().map(|k| k.to_string()).collect::<Vec<_>>();
        expected_image.sort();
        assert_eq!(keys(&json["images"][0]), expected_image);

        assert_eq!(json["images"][0]["fileName"], serde_json::Value::Null);
        assert_eq!(json["storageRootPath"], "D:\\健康管理便签照片库");
        assert_eq!(json["storageAvailable"], true);
        assert_eq!(serde_json::from_value::<CustomerMemoData>(json).unwrap().images[0].id, "a1");
    }
}
