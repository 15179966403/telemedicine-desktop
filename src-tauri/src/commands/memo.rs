// 客户随访便签（医生本地标记）相关命令
//
// 便签文本存本地数据库；照片文件存便签照片库目录（见 services::memo）。
// 数据库与磁盘读写放在阻塞线程池里执行，避免拖慢其他异步任务。
// 具体逻辑是不依赖 Tauri 的普通函数（read_memo / store_new_image 等），便于单元测试。

use crate::database::dao::memo_dao::now_rfc3339;
use crate::database::dao::MemoDao;
use crate::models::{CustomerMemo, CustomerMemoData, MemoImage};
use crate::services::memo;
use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

/// 便签文本长度上限（字符数）
const MAX_MEMO_CONTENT_CHARS: usize = 50_000;
/// 原始文件名最多保留的字符数
const MAX_FILE_NAME_CHARS: usize = 255;

// ======================= 不依赖 Tauri 的具体逻辑 =======================

/// 读取客户的完整便签：文本 + 未删除的照片列表 + 照片库位置
pub fn read_memo(
    dao: &MemoDao,
    customer_id: &str,
    library: &memo::MemoLibrary,
) -> Result<CustomerMemoData, String> {
    let text = dao
        .get_memo(customer_id)
        .map_err(|e| format!("读取随访便签失败: {}", e))?;
    let images = dao
        .list_images(customer_id)
        .map_err(|e| format!("读取便签照片列表失败: {}", e))?;
    let (content, updated_at) = match text {
        Some(saved) => (saved.content, saved.updated_at),
        None => (String::new(), None),
    };

    Ok(CustomerMemoData {
        customer_id: customer_id.to_string(),
        content,
        updated_at,
        images,
        storage_root_path: library.root.to_string_lossy().to_string(),
        storage_available: library.available,
    })
}

/// 新增或更新便签文本
pub fn save_memo_text(dao: &MemoDao, customer_id: &str, content: &str) -> Result<CustomerMemo, String> {
    if content.chars().count() > MAX_MEMO_CONTENT_CHARS {
        return Err(format!(
            "便签内容过长，最多保存 {} 个字符",
            MAX_MEMO_CONTENT_CHARS
        ));
    }
    dao.save_memo_content(customer_id, content)
        .map_err(|e| format!("保存随访便签失败: {}", e))
}

/// 保存一张新照片：校验内容 → 写入照片库 → 写数据库；数据库写入失败时删掉刚写入的文件
pub fn store_new_image(
    library_root: &Path,
    dao: &MemoDao,
    new_image: memo::NewMemoImage,
) -> Result<MemoImage, String> {
    memo::validate_path_component(&new_image.meta.customer_id, "客户档案编号")?;
    let customer_id = new_image.meta.customer_id.trim().to_string();

    // 以文件内容为准校验格式，不信任前端声明的类型
    let original_ext = memo::original_ext_for(&new_image.meta.mime_type, &new_image.original)?;
    memo::ensure_is_jpeg(&new_image.thumb)?;

    let image_id = uuid::Uuid::new_v4().to_string();
    let saved = memo::save_image(
        library_root,
        &customer_id,
        &image_id,
        original_ext,
        &new_image.original,
        &new_image.thumb,
    )?;

    let mut record = MemoImage {
        id: image_id,
        customer_id: customer_id.clone(),
        file_name: new_image
            .meta
            .file_name
            .map(|name| name.chars().take(MAX_FILE_NAME_CHARS).collect()),
        stored_name: saved.stored_name.clone(),
        thumb_name: Some(saved.thumb_name.clone()),
        mime_type: Some(new_image.meta.mime_type.to_ascii_lowercase()),
        file_size: new_image.original.len() as i64,
        width: new_image.meta.width.filter(|value| *value > 0),
        height: new_image.meta.height.filter(|value| *value > 0),
        caption: None,
        record_date: None,
        sort_order: 0,
        deleted_at: None,
        created_at: Some(now_rfc3339()),
    };
    if let Err(e) = dao.append_image(&mut record) {
        // 不留下没有记录的文件
        memo::delete_image_files(
            library_root,
            &customer_id,
            &saved.stored_name,
            Some(&saved.thumb_name),
        );
        return Err(format!("保存便签照片记录失败: {}", e));
    }
    Ok(record)
}

/// 读取照片的原图或缩略图。只根据数据库记录拼出文件名，不接收前端传入的路径
pub fn load_image_bytes(
    library_root: &Path,
    dao: &MemoDao,
    customer_id: &str,
    image_id: &str,
    thumb: bool,
) -> Result<Vec<u8>, String> {
    let image = dao
        .get_image(customer_id, image_id)
        .map_err(|e| format!("读取便签照片记录失败: {}", e))?
        .ok_or_else(|| "便签照片不存在或已删除".to_string())?;
    if image.deleted_at.is_some() {
        return Err("便签照片已删除".to_string());
    }

    // 没有缩略图的照片退回原图
    let file_name = match (thumb, image.thumb_name.as_deref()) {
        (true, Some(thumb_name)) => thumb_name,
        _ => image.stored_name.as_str(),
    };
    memo::read_image_file(library_root, customer_id, image_id, file_name)
}

/// 删除一张便签照片（软删除：记录标记为已删除，文件暂时保留，防止误删）
pub fn remove_memo_image(dao: &MemoDao, customer_id: &str, image_id: &str) -> Result<(), String> {
    let deleted = dao
        .soft_delete_image(customer_id, image_id)
        .map_err(|e| format!("删除便签照片失败: {}", e))?;
    if !deleted {
        return Err("便签照片不存在或已删除".to_string());
    }
    Ok(())
}

// ======================= Tauri 命令 =======================

/// 确定便签照片库位置：已有配置则沿用，否则探测非系统盘
fn resolve_library(app: &AppHandle) -> Result<memo::MemoLibrary, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    let detected = if memo::configured_root(&app_data_dir).is_some() {
        None
    } else {
        memo::detect_default_root()
    };
    let library = memo::resolve_library(&app_data_dir, detected)?;
    if library.available {
        memo::cleanup_stale_partials_once(&library.root);
    }
    Ok(library)
}

/// 校验来自前端的编号
fn normalize_id(value: String, label: &str) -> Result<String, String> {
    let value = value.trim().to_string();
    memo::validate_path_component(&value, label)?;
    Ok(value)
}

/// 数据库与磁盘读写放到阻塞线程池执行
async fn run_blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tokio::task::spawn_blocking(task)
        .await
        .map_err(|e| format!("便签操作未能完成: {}", e))?
}

/// 读取客户的完整便签：文本 + 未删除的照片列表 + 照片库位置
#[tauri::command]
pub async fn get_customer_memo(
    app: AppHandle,
    customer_id: String,
) -> Result<CustomerMemoData, String> {
    let customer_id = normalize_id(customer_id, "客户档案编号")?;
    let library = resolve_library(&app)?;
    run_blocking(move || {
        let dao = MemoDao::try_new()?;
        read_memo(&dao, &customer_id, &library)
    })
    .await
}

/// 新增或更新便签文本
#[tauri::command]
pub async fn save_customer_memo_content(
    customer_id: String,
    content: String,
) -> Result<CustomerMemo, String> {
    let customer_id = normalize_id(customer_id, "客户档案编号")?;
    run_blocking(move || {
        let dao = MemoDao::try_new()?;
        save_memo_text(&dao, &customer_id, &content)
    })
    .await
}

/// 添加一张便签照片。原图与缩略图以二进制原样传输，布局见 `memo::parse_add_image_payload`
#[tauri::command]
pub async fn add_memo_image(app: AppHandle, request: Request<'_>) -> Result<MemoImage, String> {
    // 整段请求体就是照片数据；先完整取出，后续处理不占用 IPC 消息
    let body: Vec<u8> = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        InvokeBody::Json(_) => {
            return Err("照片数据格式错误：需要二进制内容".to_string());
        }
    };

    let library = resolve_library(&app)?;
    if !library.available {
        return Err(library.unavailable_message());
    }

    run_blocking(move || {
        let new_image = memo::parse_add_image_payload(&body)?;
        let dao = MemoDao::try_new()?;
        store_new_image(&library.root, &dao, new_image)
    })
    .await
}

/// 读取照片文件内容（原图或缩略图），以原始字节返回
#[tauri::command]
pub async fn read_memo_image(
    app: AppHandle,
    customer_id: String,
    image_id: String,
    kind: Option<String>,
) -> Result<Response, String> {
    let customer_id = normalize_id(customer_id, "客户档案编号")?;
    let image_id = normalize_id(image_id, "照片编号")?;
    let thumb = kind.as_deref() == Some("thumb");

    let library = resolve_library(&app)?;
    let bytes = run_blocking(move || {
        let dao = MemoDao::try_new()?;
        load_image_bytes(&library.root, &dao, &customer_id, &image_id, thumb)
    })
    .await?;
    Ok(Response::new(bytes))
}

/// 删除一张便签照片（软删除）
#[tauri::command]
pub async fn delete_memo_image(customer_id: String, image_id: String) -> Result<(), String> {
    let customer_id = normalize_id(customer_id, "客户档案编号")?;
    let image_id = normalize_id(image_id, "照片编号")?;
    run_blocking(move || {
        let dao = MemoDao::try_new()?;
        remove_memo_image(&dao, &customer_id, &image_id)
    })
    .await
}

/// 在资源管理器中打开照片库目录（或某个客户的照片目录）
#[tauri::command]
pub async fn open_memo_folder(
    app: AppHandle,
    customer_id: Option<String>,
) -> Result<String, String> {
    let library = resolve_library(&app)?;
    let target: PathBuf = match customer_id {
        Some(id) if !id.trim().is_empty() => library.root.join(normalize_id(id, "客户档案编号")?),
        _ => library.root,
    };

    let path = target.to_string_lossy().to_string();
    super::report_file::open_report_local_folder(path.clone(), None).await?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::migrations::MigrationManager;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};
    use tempfile::tempdir;

    const JPEG_HEAD: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0];

    struct TestContext {
        dir: tempfile::TempDir,
        connection: crate::database::connection::DbConnection,
        dao: MemoDao,
        library: memo::MemoLibrary,
    }

    fn setup() -> TestContext {
        let dir = tempdir().unwrap();
        let conn = Connection::open(dir.path().join("test.db")).unwrap();
        MigrationManager::new().run_migrations(&conn).unwrap();
        let connection = Arc::new(Mutex::new(conn));
        TestContext {
            dao: MemoDao::with_connection(connection.clone()),
            connection,
            library: memo::MemoLibrary {
                root: dir.path().join("健康管理便签照片库"),
                available: true,
            },
            dir,
        }
    }

    /// 与前端 buildAddImagePayload 相同的请求体布局
    fn build_body(mime_type: &str, original: &[u8], thumb: &[u8]) -> Vec<u8> {
        let meta = serde_json::json!({
            "customerId": "C001",
            "fileName": "微信图片_20240501.jpg",
            "mimeType": mime_type,
            "width": 4000,
            "height": 3000,
            "thumbSize": thumb.len(),
        });
        let meta_bytes = serde_json::to_vec(&meta).unwrap();
        let mut body = Vec::new();
        body.extend_from_slice(&(meta_bytes.len() as u32).to_le_bytes());
        body.extend_from_slice(&meta_bytes);
        body.extend_from_slice(original);
        body.extend_from_slice(thumb);
        body
    }

    fn new_image(mime_type: &str, original: &[u8]) -> memo::NewMemoImage {
        memo::parse_add_image_payload(&build_body(
            mime_type,
            original,
            &[JPEG_HEAD, &[7; 12]].concat(),
        ))
        .unwrap()
    }

    fn customer_files(ctx: &TestContext) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(ctx.library.root.join("C001"))
            .map(|entries| {
                entries
                    .flatten()
                    .map(|entry| entry.file_name().to_string_lossy().to_string())
                    .collect()
            })
            .unwrap_or_default();
        names.sort();
        names
    }

    #[test]
    fn new_images_are_stored_with_files_and_ordered_records() {
        let ctx = setup();
        let first_original = [JPEG_HEAD, &[1; 300]].concat();
        let second_original = [JPEG_HEAD, &[2; 200]].concat();

        let first = store_new_image(&ctx.library.root, &ctx.dao, new_image("image/jpeg", &first_original)).unwrap();
        let second = store_new_image(&ctx.library.root, &ctx.dao, new_image("image/png", b"\x89PNG\r\n\x1a\n10")).unwrap();

        assert_eq!(first.stored_name, format!("{}.jpg", first.id));
        let first_thumb = format!("{}_thumb.jpg", first.id);
        assert_eq!(first.thumb_name.as_deref(), Some(first_thumb.as_str()));
        assert_eq!(first.file_name.as_deref(), Some("微信图片_20240501.jpg"));
        assert_eq!((first.mime_type.as_deref(), first.file_size), (Some("image/jpeg"), 300 + JPEG_HEAD.len() as i64));
        assert_eq!((first.width, first.height), (Some(4000), Some(3000)));
        assert_eq!((first.sort_order, second.sort_order), (0, 1));
        assert_eq!(second.mime_type.as_deref(), Some("image/png"));

        let mut expected: Vec<String> = [
            first.stored_name.clone(),
            format!("{}_thumb.jpg", first.id),
            second.stored_name.clone(),
            format!("{}_thumb.jpg", second.id),
        ]
        .to_vec();
        expected.sort();
        assert_eq!(customer_files(&ctx), expected);

        let images = ctx.dao.list_images("C001").unwrap();
        assert_eq!(images.len(), 2);
        assert_eq!(images[0].id, first.id);
    }

    #[test]
    fn files_are_removed_when_the_database_record_cannot_be_saved() {
        let ctx = setup();
        // 让照片记录表不存在，模拟数据库写入失败
        ctx.connection.lock().unwrap().execute_batch("DROP TABLE customer_memo_images").unwrap();

        let result = store_new_image(&ctx.library.root, &ctx.dao, new_image("image/jpeg", &[JPEG_HEAD, &[3; 40]].concat()));

        assert!(result.unwrap_err().contains("保存便签照片记录失败"));
        assert!(customer_files(&ctx).is_empty());
    }

    #[test]
    fn content_must_match_the_declared_image_type() {
        let ctx = setup();
        let png_declared_as_jpeg = new_image("image/jpeg", b"\x89PNG\r\n\x1a\n10");

        let err = store_new_image(&ctx.library.root, &ctx.dao, png_declared_as_jpeg).unwrap_err();

        assert!(err.contains("不支持的照片格式"), "{err}");
        assert!(!ctx.library.root.join("C001").exists());
        assert!(ctx.dao.list_images("C001").unwrap().is_empty());
    }

    #[test]
    fn stored_images_can_be_read_back_until_deleted() {
        let ctx = setup();
        let original = [JPEG_HEAD, &[9; 120]].concat();
        let record = store_new_image(&ctx.library.root, &ctx.dao, new_image("image/jpeg", &original)).unwrap();
        let thumb = [JPEG_HEAD, &[7; 12]].concat();

        assert_eq!(load_image_bytes(&ctx.library.root, &ctx.dao, "C001", &record.id, false).unwrap(), original);
        assert_eq!(load_image_bytes(&ctx.library.root, &ctx.dao, "C001", &record.id, true).unwrap(), thumb);
        // 其他客户名下读不到这张照片
        assert!(load_image_bytes(&ctx.library.root, &ctx.dao, "C002", &record.id, false).is_err());

        // 没有缩略图的记录：读取缩略图时退回原图
        let saved = memo::save_image(&ctx.library.root, "C001", "legacy-1", "jpg", &original, &thumb).unwrap();
        let mut legacy = MemoImage {
            id: "legacy-1".to_string(),
            customer_id: "C001".to_string(),
            file_name: None,
            stored_name: saved.stored_name,
            thumb_name: None,
            mime_type: Some("image/jpeg".to_string()),
            file_size: original.len() as i64,
            width: None,
            height: None,
            caption: None,
            record_date: None,
            sort_order: 0,
            deleted_at: None,
            created_at: Some(now_rfc3339()),
        };
        ctx.dao.append_image(&mut legacy).unwrap();
        assert_eq!(
            load_image_bytes(&ctx.library.root, &ctx.dao, "C001", "legacy-1", true).unwrap(),
            original
        );

        assert!(remove_memo_image(&ctx.dao, "C001", &record.id).is_ok());
        assert!(remove_memo_image(&ctx.dao, "C001", &record.id).unwrap_err().contains("已删除"));
        assert!(load_image_bytes(&ctx.library.root, &ctx.dao, "C001", &record.id, false).unwrap_err().contains("已删除"));
        // 软删除：文件还在磁盘上
        assert!(ctx.library.root.join("C001").join(&record.stored_name).exists());
    }

    #[test]
    fn read_memo_returns_text_images_and_storage_location() {
        let ctx = setup();
        save_memo_text(&ctx.dao, "C001", "随访要点").unwrap();
        let record = store_new_image(&ctx.library.root, &ctx.dao, new_image("image/jpeg", &[JPEG_HEAD, &[5; 50]].concat())).unwrap();

        let data = read_memo(&ctx.dao, "C001", &ctx.library).unwrap();

        assert_eq!(data.content, "随访要点");
        assert!(data.updated_at.is_some());
        assert_eq!(data.images.len(), 1);
        assert_eq!(data.images[0].id, record.id);
        assert_eq!(data.storage_root_path, ctx.library.root.to_string_lossy());
        assert!(data.storage_available);

        // 文本过长时拒绝保存
        let too_long = "字".repeat(MAX_MEMO_CONTENT_CHARS + 1);
        assert!(save_memo_text(&ctx.dao, "C001", &too_long).unwrap_err().contains("过长"));
        assert_eq!(read_memo(&ctx.dao, "C001", &ctx.library).unwrap().content, "随访要点");
    }

    #[test]
    fn frontend_ids_are_validated_before_touching_disk() {
        let ctx = setup();
        let mut bad = new_image("image/jpeg", JPEG_HEAD);
        bad.meta.customer_id = "../other".to_string();
        assert!(store_new_image(&ctx.library.root, &ctx.dao, bad).is_err());

        assert!(normalize_id("..".to_string(), "编号").is_err());
        assert!(normalize_id(" a/b ".to_string(), "编号").is_err());
        assert_eq!(normalize_id(" 123 ".to_string(), "编号").unwrap(), "123");
    }
}
