// 客户随访便签照片的本地文件存储
//
// 照片保存在独立的“便签照片库”目录（首次使用时自动选择非系统盘，例如 D:\健康管理便签照片库），
// 不与体检报告库共用目录：报告库带有“一键清理 / 清理客户文件”功能，而便签照片只有本地这一份，
// 删除后无法像报告那样重新下载。

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// 便签照片库目录名
pub const MEMO_LIBRARY_DIR_NAME: &str = "健康管理便签照片库";
/// 配置文件名（位于应用数据目录），记录首次解析出的照片库位置
const CONFIG_FILE_NAME: &str = "memo_storage_config.json";
/// 没有非系统盘时，退回应用数据目录下的这个子目录
const FALLBACK_DIR_NAME: &str = "memo_images";
/// 写入过程中的临时文件后缀；只有完整写入的文件才会改成正式文件名
const PARTIAL_SUFFIX: &str = ".part";

/// 单张原图大小上限
pub const MAX_ORIGINAL_BYTES: usize = 16 * 1024 * 1024;
/// 单张缩略图大小上限
pub const MAX_THUMB_BYTES: usize = 2 * 1024 * 1024;
/// 元数据（JSON）长度上限
const MAX_META_BYTES: usize = 64 * 1024;
/// 只清理超过这个时长的 .part 文件，避免碰到正在写入的文件
const STALE_PARTIAL_AGE: Duration = Duration::from_secs(24 * 60 * 60);

/// 便签照片库位置
#[derive(Debug, Clone)]
pub struct MemoLibrary {
    pub root: PathBuf,
    /// 磁盘未连接或不可写时为 false。此时便签文本（在数据库中）不受影响，只是无法读写照片
    pub available: bool,
}

impl MemoLibrary {
    /// 照片库不可用时给医生看的提示
    pub fn unavailable_message(&self) -> String {
        format!(
            "便签照片库不可用：{}。请确认该磁盘已连接并且可以写入。",
            self.root.display()
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct MemoStorageConfig {
    root_path: Option<String>,
}

/// 校验一个来自前端的值能否安全地当作路径中的一级目录名或文件名
pub fn validate_path_component(value: &str, label: &str) -> Result<(), String> {
    let value = value.trim();
    let is_safe = !value.is_empty()
        && value.len() <= 80
        && !value.starts_with('.')
        && value
            .chars()
            .all(|c| !c.is_control() && !r#"\/:*?"<>|"#.contains(c));
    if is_safe {
        Ok(())
    } else {
        Err(format!(
            "{}格式不受支持，无法使用随访便签: {}",
            label,
            value.trim()
        ))
    }
}

/// 判断两个路径是否指向同一个位置（不区分大小写，解析符号链接）
pub fn is_same_path(a: &Path, b: &Path) -> bool {
    normalize_for_compare(a) == normalize_for_compare(b)
}

fn normalize_for_compare(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let text = resolved.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(&text)
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

/// 读取配置文件中记录的照片库目录；不创建目录、不写文件
pub fn configured_root(app_data_dir: &Path) -> Option<PathBuf> {
    let content = std::fs::read_to_string(app_data_dir.join(CONFIG_FILE_NAME)).ok()?;
    let config: MemoStorageConfig = serde_json::from_str(&content).ok()?;
    let root = config.root_path?.trim().to_string();
    if root.is_empty() {
        None
    } else {
        Some(PathBuf::from(root))
    }
}

/// 自动探测默认照片库：按盘符顺序取第一个非系统盘（D: 起），只认本地固定磁盘
pub fn detect_default_root() -> Option<PathBuf> {
    candidate_drive_roots()
        .into_iter()
        .find(|drive| is_fixed_drive(drive))
        .map(|drive| drive.join(MEMO_LIBRARY_DIR_NAME))
}

fn candidate_drive_roots() -> Vec<PathBuf> {
    ('D'..='Z').map(|letter| PathBuf::from(format!("{letter}:\\"))).collect()
}

#[cfg(windows)]
fn is_fixed_drive(drive_root: &Path) -> bool {
    use std::os::windows::ffi::OsStrExt;
    const DRIVE_FIXED: u32 = 3;
    extern "system" {
        fn GetDriveTypeW(lp_root_path_name: *const u16) -> u32;
    }

    let wide: Vec<u16> = drive_root.as_os_str().encode_wide().chain(Some(0)).collect();
    // SAFETY: 传入的是以空字符结尾的合法宽字符串，函数返回后不再使用该指针
    unsafe { GetDriveTypeW(wide.as_ptr()) == DRIVE_FIXED }
}

#[cfg(not(windows))]
fn is_fixed_drive(_drive_root: &Path) -> bool {
    false
}

/// 确定照片库位置。
///
/// 已有配置时始终沿用，照片位置不会随盘符探测结果变化；首次使用时取探测结果，
/// 没有非系统盘则退回应用数据目录，并把结果写入配置。
pub fn resolve_library(
    app_data_dir: &Path,
    detected_library: Option<PathBuf>,
) -> Result<MemoLibrary, String> {
    if let Some(root) = configured_root(app_data_dir) {
        let available = std::fs::create_dir_all(&root).is_ok();
        return Ok(MemoLibrary { root, available });
    }

    let root = detected_library.unwrap_or_else(|| app_data_dir.join(FALLBACK_DIR_NAME));
    let available = std::fs::create_dir_all(&root).is_ok();

    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("创建应用数据目录失败 {}: {}", app_data_dir.display(), e))?;
    let config = MemoStorageConfig {
        root_path: Some(root.to_string_lossy().to_string()),
    };
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("生成便签照片库配置失败: {}", e))?;
    std::fs::write(app_data_dir.join(CONFIG_FILE_NAME), json)
        .map_err(|e| format!("保存便签照片库配置失败: {}", e))?;

    Ok(MemoLibrary { root, available })
}

/// 已落盘的照片文件名
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedImageFiles {
    pub stored_name: String,
    pub thumb_name: String,
}

/// 保存一张照片的原图与缩略图：{照片库}/{客户档案编号}/{照片编号}.{ext} 与 {照片编号}_thumb.jpg
pub fn save_image(
    root: &Path,
    customer_id: &str,
    image_id: &str,
    original_ext: &str,
    original: &[u8],
    thumb: &[u8],
) -> Result<SavedImageFiles, String> {
    validate_path_component(customer_id, "客户档案编号")?;
    validate_path_component(image_id, "照片编号")?;
    if original.is_empty() || thumb.is_empty() {
        return Err("照片内容为空".to_string());
    }

    let dir = root.join(customer_id.trim());
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建便签照片目录失败 {}: {}", dir.display(), e))?;

    let stored_name = format!("{image_id}.{original_ext}");
    let thumb_name = format!("{image_id}_thumb.jpg");
    let partial_original = dir.join(format!("{stored_name}{PARTIAL_SUFFIX}"));
    let partial_thumb = dir.join(format!("{thumb_name}{PARTIAL_SUFFIX}"));

    write_new_file(&partial_original, original)?;
    if let Err(e) = write_new_file(&partial_thumb, thumb) {
        let _ = std::fs::remove_file(&partial_original);
        return Err(e);
    }

    // 两份都写完后再改成正式文件名：正式文件名下只会出现完整文件
    if let Err(e) = std::fs::rename(&partial_original, dir.join(&stored_name)) {
        let _ = std::fs::remove_file(&partial_original);
        let _ = std::fs::remove_file(&partial_thumb);
        return Err(format!("保存便签照片失败: {}", e));
    }
    if let Err(e) = std::fs::rename(&partial_thumb, dir.join(&thumb_name)) {
        let _ = std::fs::remove_file(&partial_thumb);
        let _ = std::fs::remove_file(dir.join(&stored_name));
        return Err(format!("保存便签缩略图失败: {}", e));
    }

    Ok(SavedImageFiles { stored_name, thumb_name })
}

fn write_new_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    std::fs::write(path, bytes).map_err(|e| format!("写入便签照片文件失败 {}: {}", path.display(), e))
}

/// 删除一张照片的原图与缩略图文件；客户目录空了则顺带删除
pub fn delete_image_files(
    root: &Path,
    customer_id: &str,
    stored_name: &str,
    thumb_name: Option<&str>,
) {
    validate_path_component(customer_id, "客户档案编号").ok();
    let dir = root.join(customer_id.trim());
    if validate_path_component(stored_name, "照片文件名").is_ok() {
        let _ = std::fs::remove_file(dir.join(stored_name));
    }
    if let Some(thumb) = thumb_name {
        if validate_path_component(thumb, "缩略图文件名").is_ok() {
            let _ = std::fs::remove_file(dir.join(thumb));
        }
    }
    if let Ok(mut entries) = std::fs::read_dir(&dir) {
        if entries.next().is_none() {
            let _ = std::fs::remove_dir(&dir);
        }
    }
}

/// 读取照片文件。只允许读取该照片自己的原图或缩略图，不接收任意路径
pub fn read_image_file(
    root: &Path,
    customer_id: &str,
    image_id: &str,
    file_name: &str,
) -> Result<Vec<u8>, String> {
    validate_path_component(customer_id, "客户档案编号")?;
    validate_path_component(image_id, "照片编号")?;
    validate_path_component(file_name, "照片文件名")?;

    let ext = file_name.strip_prefix(image_id).and_then(|rest| rest.strip_prefix('.')).unwrap_or_default();
    // 原图文件名必须是 {照片编号}.{扩展名}，缩略图必须是 {照片编号}_thumb.jpg
    let is_original = !ext.is_empty()
        && ext.len() <= 5
        && ext.bytes().all(|b| b.is_ascii_alphanumeric());
    let is_thumb = file_name == format!("{image_id}_thumb.jpg");
    if !(is_original || is_thumb) {
        return Err("照片文件名与照片编号不匹配".to_string());
    }

    let path = root.join(customer_id.trim()).join(file_name);
    std::fs::read(&path).map_err(|_| {
        format!(
            "读取便签照片失败，文件可能已被移动或删除: {}",
            path.display()
        )
    })
}

/// 前端提交的照片元数据（位于二进制请求体的开头，JSON 格式）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewMemoImageMeta {
    pub customer_id: String,
    pub file_name: Option<String>,
    pub mime_type: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub thumb_size: usize,
}

/// 解析后的待保存照片
#[derive(Debug)]
pub struct NewMemoImage {
    pub meta: NewMemoImageMeta,
    pub original: Vec<u8>,
    pub thumb: Vec<u8>,
}

/// 解析“添加照片”的请求体。
///
/// 照片以二进制原样传输（转成 JSON 数字数组传输几兆字节的照片太慢），布局为：
/// [4 字节：元数据长度（小端）][元数据 JSON][原图][缩略图]
pub fn parse_add_image_payload(body: &[u8]) -> Result<NewMemoImage, String> {
    if body.len() > MAX_ORIGINAL_BYTES + MAX_THUMB_BYTES + MAX_META_BYTES + 4 {
        return Err("照片数据过大，无法保存".to_string());
    }
    if body.len() < 5 {
        return Err("照片数据不完整".to_string());
    }

    let meta_len = u32::from_le_bytes([body[0], body[1], body[2], body[3]]) as usize;
    if meta_len == 0 || meta_len > MAX_META_BYTES || 4 + meta_len >= body.len() {
        return Err("照片数据格式错误".to_string());
    }
    let meta: NewMemoImageMeta = serde_json::from_slice(&body[4..4 + meta_len])
        .map_err(|e| format!("照片信息解析失败: {}", e))?;

    let data = &body[4 + meta_len..];
    if meta.thumb_size == 0 || meta.thumb_size >= data.len() {
        return Err("照片数据格式错误：缩略图长度非法".to_string());
    }
    let (original, thumb) = data.split_at(data.len() - meta.thumb_size);
    if original.len() > MAX_ORIGINAL_BYTES {
        return Err("照片过大，单张最多支持 16MB".to_string());
    }
    if thumb.len() > MAX_THUMB_BYTES {
        return Err("缩略图数据过大".to_string());
    }

    Ok(NewMemoImage {
        meta,
        original: original.to_vec(),
        thumb: thumb.to_vec(),
    })
}

/// 根据声明的类型与文件头判断原图格式，返回存储用的扩展名
pub fn original_ext_for(mime_type: &str, bytes: &[u8]) -> Result<&'static str, String> {
    match (mime_type.to_ascii_lowercase().as_str(), bytes) {
        ("image/jpeg", [0xFF, 0xD8, 0xFF, ..]) => Ok("jpg"),
        ("image/png", [0x89, b'P', b'N', b'G', ..]) => Ok("png"),
        ("image/webp", [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..]) => Ok("webp"),
        _ => Err(format!("不支持的照片格式: {}", mime_type)),
    }
}

/// 缩略图统一为 JPEG
pub fn ensure_is_jpeg(bytes: &[u8]) -> Result<(), String> {
    match bytes {
        [0xFF, 0xD8, 0xFF, ..] => Ok(()),
        _ => Err("缩略图格式错误".to_string()),
    }
}

/// 清理异常退出遗留的 .part 临时文件，返回清理数量。正式照片文件不会被触碰
pub fn cleanup_stale_partials(root: &Path, min_age: Duration) -> usize {
    let cutoff = SystemTime::now()
        .checked_sub(min_age)
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let mut removed = 0;

    let Ok(customers) = std::fs::read_dir(root) else {
        return 0;
    };
    for customer in customers.flatten() {
        if !customer.path().is_dir() {
            continue;
        }
        let Ok(files) = std::fs::read_dir(customer.path()) else {
            continue;
        };
        for file in files.flatten() {
            let path = file.path();
            let name = path.to_string_lossy().to_string();
            let Ok(meta) = file.metadata() else {
                continue;
            };
            if !meta.is_file() || !name.ends_with(PARTIAL_SUFFIX) {
                continue;
            }
            let modified = meta.modified().unwrap_or(SystemTime::now());
            if modified <= cutoff && std::fs::remove_file(&path).is_ok() {
                removed += 1;
            }
        }
    }
    removed
}

/// 每次运行只清理一次遗留临时文件
pub fn cleanup_stale_partials_once(root: &Path) {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let removed = cleanup_stale_partials(root, STALE_PARTIAL_AGE);
        if removed > 0 {
            println!("Cleaned up {} stale memo image temp files", removed);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    const JPEG_HEAD: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0];

    fn build_payload(meta: &serde_json::Value, original: &[u8], thumb: &[u8]) -> Vec<u8> {
        let meta_bytes = serde_json::to_vec(meta).unwrap();
        let mut body = Vec::with_capacity(4 + meta_bytes.len() + original.len() + thumb.len());
        body.extend_from_slice(&(meta_bytes.len() as u32).to_le_bytes());
        body.extend_from_slice(&meta_bytes);
        body.extend_from_slice(original);
        body.extend_from_slice(thumb);
        body
    }

    fn sample_meta(thumb_size: usize) -> serde_json::Value {
        serde_json::json!({
            "customerId": "C001",
            "fileName": "微信图片_20240501.jpg",
            "mimeType": "image/jpeg",
            "width": 4000,
            "height": 3000,
            "thumbSize": thumb_size,
        })
    }

    #[test]
    fn validate_path_component_rejects_unsafe_names() {
        assert!(validate_path_component("123", "编号").is_ok());
        assert!(validate_path_component("a-b_c", "编号").is_ok());
        for bad in ["", "  ", ".", "..", ".hidden", "a/b", "a\\b", "C:", "a*b", "a\nb"] {
            assert!(validate_path_component(bad, "编号").is_err(), "should reject {bad:?}");
        }
        let long = "a".repeat(81);
        assert!(validate_path_component(&long, "编号").is_err());
    }

    #[test]
    fn is_same_path_ignores_case_and_trailing_separator() {
        let temp = tempdir().unwrap();
        let lib = temp.path().join("lib");
        std::fs::create_dir_all(&lib).unwrap();

        let mut with_slash = lib.clone().into_os_string();
        with_slash.push("\\");
        assert!(is_same_path(Path::new(&with_slash), &lib));
        assert!(is_same_path(&lib, &PathBuf::from(lib.to_string_lossy().to_uppercase())));
        assert!(!is_same_path(&lib, &temp.path()));
        assert!(!is_same_path(&lib, &lib.join("child")));
    }

    #[test]
    fn resolve_library_persists_first_choice_and_reuses_it() {
        let temp = tempdir().unwrap();
        let app_data = temp.path().join("app_data");

        let first = resolve_library(&app_data, Some(temp.path().join("D-lib"))).unwrap();
        assert_eq!(first.root, temp.path().join("D-lib"));
        assert!(first.available);
        assert_eq!(configured_root(&app_data), Some(temp.path().join("D-lib")));

        // 之后即使探测结果变了，也沿用第一次保存的位置
        let second = resolve_library(&app_data, Some(temp.path().join("E-lib"))).unwrap();
        assert_eq!(second.root, temp.path().join("D-lib"));
    }

    #[test]
    fn resolve_library_falls_back_to_app_data_without_other_drive() {
        let temp = tempdir().unwrap();
        let app_data = temp.path().join("app_data");

        let library = resolve_library(&app_data, None).unwrap();
        assert_eq!(library.root, app_data.join("memo_images"));
        assert!(library.root.is_dir());
    }

    #[test]
    fn resolve_library_reports_unavailable_drive_without_switching_location() {
        let temp = tempdir().unwrap();
        let app_data = temp.path().join("app_data");
        // 用一个普通文件充当“目录”，让 create_dir_all 必然失败
        let blocked = temp.path().join("blocked");
        std::fs::write(&blocked, b"not a dir").unwrap();

        let library = resolve_library(&app_data, Some(blocked.join("lib"))).unwrap();
        assert!(!library.available);
        assert_eq!(library.root, blocked.join("lib"));
        assert!(library.unavailable_message().contains("便签照片库不可用"));
    }

    #[test]
    fn candidate_drives_start_after_system_drive() {
        let candidates = candidate_drive_roots();
        assert_eq!(candidates.first().unwrap().to_string_lossy(), "D:\\");
        assert_eq!(candidates.last().unwrap().to_string_lossy(), "Z:\\");
        assert_eq!(candidates.len(), 23);
    }

    #[test]
    fn save_then_read_image_files() {
        let temp = tempdir().unwrap();
        let original = [JPEG_HEAD, &[0x11; 512]].concat();
        let thumb = [JPEG_HEAD, &[0x22; 16]].concat();

        let saved = save_image(temp.path(), "C001", "id-1", "jpg", &original, &thumb).unwrap();
        assert_eq!(saved.stored_name, "id-1.jpg");
        assert_eq!(saved.thumb_name, "id-1_thumb.jpg");

        assert_eq!(read_image_file(temp.path(), "C001", "id-1", "id-1.jpg").unwrap(), original);
        assert_eq!(
            read_image_file(temp.path(), "C001", "id-1", "id-1_thumb.jpg").unwrap(),
            thumb
        );

        // 不留下临时文件
        let names: Vec<String> = std::fs::read_dir(temp.path().join("C001"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        let mut expected = vec!["id-1.jpg".to_string(), "id-1_thumb.jpg".to_string()];
        expected.sort();
        let mut names = names;
        names.sort();
        assert_eq!(names, expected);

        delete_image_files(temp.path(), "C001", "id-1.jpg", Some("id-1_thumb.jpg"));
        assert!(!temp.path().join("C001").exists());
        assert!(read_image_file(temp.path(), "C001", "id-1", "id-1.jpg").is_err());
    }

    #[test]
    fn save_image_rolls_back_when_thumb_cannot_be_written() {
        let temp = tempdir().unwrap();
        // 让缩略图的临时文件名被一个目录占住，写入必然失败
        std::fs::create_dir_all(temp.path().join("C001").join("id-2_thumb.jpg.part")).unwrap();

        let result = save_image(temp.path(), "C001", "id-2", "jpg", JPEG_HEAD, JPEG_HEAD);
        assert!(result.is_err());
        // 失败后不留任何原图文件
        assert!(!temp.path().join("C001").join("id-2.jpg").exists());
        assert!(!temp.path().join("C001").join("id-2.jpg.part").exists());
    }

    #[test]
    fn read_image_file_only_allows_own_files() {
        let temp = tempdir().unwrap();
        save_image(temp.path(), "C001", "id-3", "jpg", JPEG_HEAD, JPEG_HEAD).unwrap();

        for (customer, id, name) in [
            ("C001", "id-3", "other.jpg"),
            ("C001", "id-3", "id-3_thumb.jpg.bak"),
            ("C001", "other", "id-3.jpg"),
            ("..", "id-3", "id-3.jpg"),
            ("C001", "..", "..jpg"),
            ("C001", "id-3", "id-3.jpg.part"),
        ] {
            assert!(
                read_image_file(temp.path(), customer, id, name).is_err(),
                "should reject {customer}/{id}/{name}"
            );
        }
    }

    #[test]
    fn save_image_rejects_unsafe_ids() {
        let temp = tempdir().unwrap();
        assert!(save_image(temp.path(), "..", "id", "jpg", JPEG_HEAD, JPEG_HEAD).is_err());
        assert!(save_image(temp.path(), "C001", "a/b", "jpg", JPEG_HEAD, JPEG_HEAD).is_err());
        assert!(save_image(temp.path(), "C001", "id", "jpg", &[], JPEG_HEAD).is_err());
        assert!(!temp.path().join("..").join("id.jpg").exists());
    }

    #[test]
    fn parse_payload_reads_meta_original_and_thumb() {
        let original = [JPEG_HEAD, &[7; 300]].concat();
        let thumb = [JPEG_HEAD, &[9; 20]].concat();
        let body = build_payload(&sample_meta(thumb.len()), &original, &thumb);

        let parsed = parse_add_image_payload(&body).unwrap();
        assert_eq!(parsed.meta.customer_id, "C001");
        assert_eq!(parsed.meta.file_name.as_deref(), Some("微信图片_20240501.jpg"));
        assert_eq!(parsed.meta.mime_type, "image/jpeg");
        assert_eq!((parsed.meta.width, parsed.meta.height), (Some(4000), Some(3000)));
        assert_eq!(parsed.original, original);
        assert_eq!(parsed.thumb, thumb);
    }

    #[test]
    fn parse_payload_rejects_malformed_bodies() {
        let original = [JPEG_HEAD, &[7; 30]].concat();
        let thumb = [JPEG_HEAD, &[9; 10]].concat();
        let valid = build_payload(&sample_meta(thumb.len()), &original, &thumb);

        assert!(parse_add_image_payload(&[]).is_err());
        assert!(parse_add_image_payload(&valid[..3]).is_err());
        // 元数据长度超出实际数据
        assert!(parse_add_image_payload(&build_payload(&sample_meta(10_000), &original, &thumb)).is_err());
        // 缩略图长度为 0 或吞掉整个原图
        assert!(parse_add_image_payload(&build_payload(&sample_meta(0), &original, &thumb)).is_err());
        assert!(parse_add_image_payload(&build_payload(&sample_meta(original.len() + thumb.len()), &original, &thumb)).is_err());
        // 元数据不是 JSON
        assert!(parse_add_image_payload(&build_payload(&serde_json::json!({ "customerId": 1 }), &original, &thumb)).is_err());

        let too_large = vec![0u8; MAX_ORIGINAL_BYTES + MAX_THUMB_BYTES + MAX_META_BYTES + 5];
        assert!(parse_add_image_payload(&too_large).is_err());
        assert_eq!(parse_add_image_payload(&valid).unwrap().original, original);
    }

    #[test]
    fn file_type_is_checked_against_file_header() {
        assert_eq!(original_ext_for("image/jpeg", JPEG_HEAD).unwrap(), "jpg");
        assert_eq!(original_ext_for("IMAGE/JPEG", JPEG_HEAD).unwrap(), "jpg");
        assert_eq!(original_ext_for("image/png", b"\x89PNG\r\n\x1a\n").unwrap(), "png");
        assert_eq!(original_ext_for("image/webp", b"RIFF\0\0\0\0WEBPVP8 ").unwrap(), "webp");
        // 声明类型与文件内容不符，或类型不在支持范围内
        assert!(original_ext_for("image/jpeg", b"\x89PNG\r\n\x1a\n").is_err());
        assert!(original_ext_for("image/png", JPEG_HEAD).is_err());
        assert!(original_ext_for("image/gif", b"GIF89a").is_err());
        // RIFF 容器但不是 WebP
        assert!(original_ext_for("image/webp", b"RIFF\0\0\0\0WAVEfmt ").is_err());
        assert!(ensure_is_jpeg(JPEG_HEAD).is_ok());
        assert!(ensure_is_jpeg(b"\x89PNG\r\n\x1a\n").is_err());
    }

    #[test]
    fn cleanup_removes_only_stale_partial_files() {
        let temp = tempdir().unwrap();
        let customer_dir = temp.path().join("C001");
        std::fs::create_dir_all(&customer_dir).unwrap();

        let stale = customer_dir.join("old.jpg.part");
        let fresh = customer_dir.join("fresh.jpg.part");
        let real = customer_dir.join("real.jpg");
        std::fs::write(&stale, b"x").unwrap();
        std::fs::write(&fresh, b"x").unwrap();
        std::fs::write(&real, b"x").unwrap();
        let two_days_ago = SystemTime::now() - Duration::from_secs(2 * 24 * 60 * 60);
        std::fs::File::options()
            .write(true)
            .open(&stale)
            .unwrap()
            .set_modified(two_days_ago)
            .unwrap();

        let removed = cleanup_stale_partials(temp.path(), Duration::from_secs(24 * 60 * 60));
        assert_eq!(removed, 1);
        assert!(!stale.exists());
        assert!(fresh.exists());
        assert!(real.exists());

        // 照片库目录还不存在时静默返回
        assert_eq!(cleanup_stale_partials(&temp.path().join("missing"), Duration::ZERO), 0);
    }
}
