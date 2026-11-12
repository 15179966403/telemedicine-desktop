// 体检报告本地文件资产管理命令模块
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReportStorageConfig {
    #[serde(rename = "rootPath")]
    pub root_path: String,
    #[serde(rename = "diskFreeBytes")]
    pub disk_free_bytes: u64,
    #[serde(rename = "diskFreeGb")]
    pub disk_free_gb: f64,
    #[serde(rename = "isCustom")]
    pub is_custom: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SingleReportFileInfo {
    pub url: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "localPath")]
    pub local_path: String,
    pub exists: bool,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "isOutdated")]
    pub is_outdated: bool,
    #[serde(rename = "modifiedTime")]
    pub modified_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportStatusResult {
    #[serde(rename = "customerDir")]
    pub customer_dir: String,
    #[serde(rename = "reportDir")]
    pub report_dir: String,
    #[serde(rename = "reportDirExists")]
    pub report_dir_exists: bool,
    pub files: Vec<SingleReportFileInfo>,
    #[serde(rename = "allDownloaded")]
    pub all_downloaded: bool,
    #[serde(rename = "hasUpdates")]
    pub has_updates: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckReportStatusParams {
    #[serde(rename = "customerName")]
    pub customer_name: String,
    pub mobile: String,
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "reportId")]
    pub report_id: String,
    #[serde(rename = "reportDate")]
    pub report_date: Option<String>,
    #[serde(rename = "medicalOrg")]
    pub medical_org: Option<String>,
    #[serde(rename = "fileUrls")]
    pub file_urls: Vec<String>,
    #[serde(rename = "remoteUpdateTime")]
    pub remote_update_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadReportFileParams {
    #[serde(rename = "customerName")]
    pub customer_name: String,
    pub mobile: String,
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "reportId")]
    pub report_id: String,
    #[serde(rename = "reportDate")]
    pub report_date: Option<String>,
    #[serde(rename = "medicalOrg")]
    pub medical_org: Option<String>,
    #[serde(rename = "fileUrl")]
    pub file_url: String,
    #[serde(rename = "customFileName")]
    pub custom_file_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadReportBatchParams {
    #[serde(rename = "customerName")]
    pub customer_name: String,
    pub mobile: String,
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "reportId")]
    pub report_id: String,
    #[serde(rename = "reportDate")]
    pub report_date: Option<String>,
    #[serde(rename = "medicalOrg")]
    pub medical_org: Option<String>,
    #[serde(rename = "fileUrls")]
    pub file_urls: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub url: String,
    #[serde(rename = "localPath")]
    pub local_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct SavedConfigRecord {
    custom_root_path: Option<String>,
}

const CONFIG_FILE_NAME: &str = "report_storage_config.json";

/// 过滤 Windows 非法路径字符
fn sanitize_name(name: &str) -> String {
    let invalid_chars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    let mut cleaned = String::new();
    for c in name.chars() {
        if invalid_chars.contains(&c) || c.is_control() {
            cleaned.push('_');
        } else {
            cleaned.push(c);
        }
    }
    let res = cleaned.trim().trim_matches('.').trim();
    if res.is_empty() {
        "unknown".to_string()
    } else {
        res.to_string()
    }
}

/// 自动探测非 C 盘默认存储路径
fn get_default_report_dir() -> PathBuf {
    // 优先使用 D 盘
    if Path::new("D:\\").exists() {
        return PathBuf::from("D:\\健康管理体检报告库");
    }
    // 其次使用 E 盘
    if Path::new("E:\\").exists() {
        return PathBuf::from("E:\\健康管理体检报告库");
    }
    // 否则退回至当前用户的 Documents (我的文档) 目录，绝不污染系统根目录
    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        return PathBuf::from(user_profile)
            .join("Documents")
            .join("健康管理体检报告库");
    }
    PathBuf::from("C:\\健康管理体检报告库")
}

/// 获取指定路径所在磁盘的可用空间（字节）
#[cfg(windows)]
fn get_disk_free_bytes(path: &Path) -> u64 {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let check_dir = if path.exists() {
        path.to_path_buf()
    } else {
        path.ancestors()
            .find(|p| p.exists())
            .unwrap_or(Path::new("C:\\"))
            .to_path_buf()
    };

    let wide_path: Vec<u16> = OsStr::new(check_dir.as_os_str())
        .encode_wide()
        .chain(Some(0))
        .collect();

    let mut free_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    unsafe {
        if GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_bytes,
            &mut total_bytes,
            &mut total_free_bytes,
        ) != 0
        {
            free_bytes
        } else {
            0
        }
    }
}

#[cfg(not(windows))]
fn get_disk_free_bytes(_path: &Path) -> u64 {
    100 * 1024 * 1024 * 1024 // 非 Windows 默认模拟 100GB
}

/// 获取配置文件的绝对路径
fn get_config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    std::fs::create_dir_all(&app_dir).map_err(|e| format!("创建应用数据目录失败: {}", e))?;
    Ok(app_dir.join(CONFIG_FILE_NAME))
}

/// 读取已保存的存储根目录
fn resolve_current_root_dir(app: &AppHandle) -> (PathBuf, bool) {
    if let Ok(config_path) = get_config_file_path(app) {
        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                if let Ok(cfg) = serde_json::from_str::<SavedConfigRecord>(&content) {
                    if let Some(path_str) = cfg.custom_root_path {
                        let trimmed = path_str.trim();
                        if !trimmed.is_empty() {
                            // 旧版“互联网医院体检报告库”平滑过渡至“健康管理体检报告库”
                            let migrated = trimmed.replace("互联网医院体检报告库", "健康管理体检报告库");
                            return (PathBuf::from(migrated), true);
                        }
                    }
                }
            }
        }
    }
    (get_default_report_dir(), false)
}

/// 构建患者专属目录与报告专属目录
fn build_report_dir_paths(
    root: &Path,
    customer_name: &str,
    mobile: &str,
    customer_id: &str,
    report_id: &str,
    report_date: Option<&str>,
    medical_org: Option<&str>,
) -> (PathBuf, PathBuf) {
    let clean_name = sanitize_name(customer_name);
    let mobile_tail = if mobile.len() >= 4 {
        &mobile[mobile.len() - 4..]
    } else {
        mobile
    };
    let customer_folder_name = format!("{}_{}_{}", clean_name, mobile_tail, customer_id);

    let clean_date = report_date
        .map(|d| {
            let part = d.split(' ').next().unwrap_or(d);
            sanitize_name(part)
        })
        .unwrap_or_else(|| "未知日期".to_string());

    let clean_org = medical_org
        .map(sanitize_name)
        .unwrap_or_else(|| "未知体检机构".to_string());

    let report_folder_name = format!("{}_{}_{}", clean_date, clean_org, report_id);

    let customer_dir = root.join(customer_folder_name);
    let report_dir = customer_dir.join(report_folder_name);
    (customer_dir, report_dir)
}

/// 构建健管方案存储专属子目录（归属于同一客户根目录）
fn build_scheme_dir_paths(
    root: &Path,
    customer_name: &str,
    mobile: &str,
    customer_id: &str,
) -> (PathBuf, PathBuf) {
    let clean_name = sanitize_name(customer_name);
    let mobile_tail = if mobile.len() >= 4 {
        &mobile[mobile.len() - 4..]
    } else {
        mobile
    };
    let customer_folder_name = format!("{}_{}_{}", clean_name, mobile_tail, customer_id);
    let customer_dir = root.join(customer_folder_name);
    let scheme_dir = customer_dir.join("健管方案");
    (customer_dir, scheme_dir)
}

/// 从 URL 解析文件名
fn extract_file_name_from_url(url: &str, idx: usize) -> String {
    let path_part = url.split('?').next().unwrap_or(url);
    let raw_name = path_part.split('/').last().unwrap_or("");
    let sanitized = sanitize_name(raw_name);
    if sanitized.is_empty() || sanitized == "unknown" {
        format!("附件_{:02}.dat", idx + 1)
    } else {
        sanitized
    }
}

// ======================= Tauri Commands =======================

/// 1. 获取当前体检报告存储目录及磁盘空间
#[tauri::command]
pub async fn get_report_storage_dir(app: AppHandle) -> Result<ReportStorageConfig, String> {
    let (root_path, is_custom) = resolve_current_root_dir(&app);
    let free_bytes = get_disk_free_bytes(&root_path);
    let free_gb = (free_bytes as f64) / (1024.0 * 1024.0 * 1024.0);

    // 确保根目录可用
    let _ = std::fs::create_dir_all(&root_path);

    Ok(ReportStorageConfig {
        root_path: root_path.to_string_lossy().to_string(),
        disk_free_bytes: free_bytes,
        disk_free_gb: (free_gb * 100.0).round() / 100.0,
        is_custom,
    })
}

/// 2. 设置新的体检报告存储目录
#[tauri::command]
pub async fn set_report_storage_dir(
    app: AppHandle,
    new_path: String,
) -> Result<ReportStorageConfig, String> {
    let path = PathBuf::from(new_path.trim());
    if path.as_os_str().is_empty() {
        return Err("存储路径不能为空".to_string());
    }

    std::fs::create_dir_all(&path).map_err(|e| format!("无法创建指定的存储目录: {}", e))?;

    let config_path = get_config_file_path(&app)?;
    let record = SavedConfigRecord {
        custom_root_path: Some(path.to_string_lossy().to_string()),
    };
    let json_str = serde_json::to_string_pretty(&record)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    std::fs::write(&config_path, json_str).map_err(|e| format!("保存配置失败: {}", e))?;

    let free_bytes = get_disk_free_bytes(&path);
    let free_gb = (free_bytes as f64) / (1024.0 * 1024.0 * 1024.0);

    Ok(ReportStorageConfig {
        root_path: path.to_string_lossy().to_string(),
        disk_free_bytes: free_bytes,
        disk_free_gb: (free_gb * 100.0).round() / 100.0,
        is_custom: true,
    })
}

/// 3. 调起系统原生文件夹选择对话框
#[tauri::command]
pub async fn select_report_folder_dialog() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            let output = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '请选择体检报告存放文件夹'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }",
                ])
                .output()
                .map_err(|e| format!("启动文件夹选择器失败: {}", e))?;

            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if path.is_empty() {
                Ok(None)
            } else {
                Ok(Some(path))
            }
        }

        #[cfg(not(windows))]
        {
            Ok(None)
        }
    })
    .await
    .map_err(|e| format!("运行任务异常: {}", e))?
}

/// 4. 检查某份报告下文件的本地下载状态与更新情况
#[tauri::command]
pub async fn check_report_file_status(
    app: AppHandle,
    params: CheckReportStatusParams,
) -> Result<ReportStatusResult, String> {
    let (root_path, _) = resolve_current_root_dir(&app);
    let (customer_dir, report_dir) = build_report_dir_paths(
        &root_path,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
        &params.report_id,
        params.report_date.as_deref(),
        params.medical_org.as_deref(),
    );

    let report_dir_exists = report_dir.exists();
    let mut files_info = Vec::new();
    let mut all_downloaded = !params.file_urls.is_empty();
    let mut has_updates = false;

    // 解析远端更新时间
    let remote_dt: Option<DateTime<Utc>> = params
        .remote_update_time
        .as_deref()
        .and_then(|t| DateTime::parse_from_rfc3339(t).ok().map(|dt| dt.with_timezone(&Utc)))
        .or_else(|| {
            // 尝试按标准 YYYY-MM-DD HH:mm:ss 解析
            params.remote_update_time.as_deref().and_then(|t| {
                chrono::NaiveDateTime::parse_from_str(t, "%Y-%m-%d %H:%M:%S")
                    .ok()
                    .map(|ndt| DateTime::<Utc>::from_naive_utc_and_offset(ndt, Utc))
            })
        });

    for (idx, url) in params.file_urls.iter().enumerate() {
        let file_name = extract_file_name_from_url(url, idx);
        let file_path = report_dir.join(&file_name);

        let exists = file_path.exists();
        let mut file_size = 0;
        let mut is_outdated = false;
        let mut modified_time_str = None;

        if exists {
            if let Ok(meta) = std::fs::metadata(&file_path) {
                file_size = meta.len();
                if let Ok(mod_time) = meta.modified() {
                    let local_dt: DateTime<Utc> = mod_time.into();
                    modified_time_str = Some(local_dt.format("%Y-%m-%d %H:%M:%S").to_string());

                    if let Some(rdt) = remote_dt {
                        if rdt > local_dt {
                            is_outdated = true;
                            has_updates = true;
                        }
                    }
                }
            }
        } else {
            all_downloaded = false;
        }

        files_info.push(SingleReportFileInfo {
            url: url.clone(),
            file_name,
            local_path: file_path.to_string_lossy().to_string(),
            exists,
            file_size,
            is_outdated,
            modified_time: modified_time_str,
        });
    }

    if params.file_urls.is_empty() {
        all_downloaded = false;
    }

    Ok(ReportStatusResult {
        customer_dir: customer_dir.to_string_lossy().to_string(),
        report_dir: report_dir.to_string_lossy().to_string(),
        report_dir_exists,
        files: files_info,
        all_downloaded,
        has_updates,
    })
}

/// 5. 下载单个报告附件文件至本地规范目录
#[tauri::command]
pub async fn download_single_report_file(
    app: AppHandle,
    params: DownloadReportFileParams,
) -> Result<DownloadResult, String> {
    let (root_path, _) = resolve_current_root_dir(&app);
    let (_, report_dir) = build_report_dir_paths(
        &root_path,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
        &params.report_id,
        params.report_date.as_deref(),
        params.medical_org.as_deref(),
    );

    std::fs::create_dir_all(&report_dir)
        .map_err(|e| format!("创建报告目录失败 {:?}: {}", report_dir, e))?;

    let file_name = params.custom_file_name.unwrap_or_else(|| {
        extract_file_name_from_url(&params.file_url, 0)
    });
    let local_file_path = report_dir.join(&file_name);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(&params.file_url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(DownloadResult {
            success: false,
            url: params.file_url,
            local_path: local_file_path.to_string_lossy().to_string(),
            file_name,
            file_size: 0,
            error: Some(format!("服务器返回错误 HTTP {}", response.status())),
        });
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取文件内容失败: {}", e))?;

    let file_size = bytes.len() as u64;
    tokio::fs::write(&local_file_path, bytes)
        .await
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(DownloadResult {
        success: true,
        url: params.file_url,
        local_path: local_file_path.to_string_lossy().to_string(),
        file_name,
        file_size,
        error: None,
    })
}

/// 6. 批量下载某份报告下的全部文件至本地规范目录
#[tauri::command]
pub async fn download_batch_report_files(
    app: AppHandle,
    params: DownloadReportBatchParams,
) -> Result<Vec<DownloadResult>, String> {
    let (root_path, _) = resolve_current_root_dir(&app);
    let (_, report_dir) = build_report_dir_paths(
        &root_path,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
        &params.report_id,
        params.report_date.as_deref(),
        params.medical_org.as_deref(),
    );

    std::fs::create_dir_all(&report_dir)
        .map_err(|e| format!("创建报告目录失败 {:?}: {}", report_dir, e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut results = Vec::new();

    for (idx, url) in params.file_urls.iter().enumerate() {
        let file_name = extract_file_name_from_url(url, idx);
        let local_file_path = report_dir.join(&file_name);

        match client.get(url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    match resp.bytes().await {
                        Ok(bytes) => {
                            let file_size = bytes.len() as u64;
                            if let Err(e) = tokio::fs::write(&local_file_path, bytes).await {
                                results.push(DownloadResult {
                                    success: false,
                                    url: url.clone(),
                                    local_path: local_file_path.to_string_lossy().to_string(),
                                    file_name,
                                    file_size: 0,
                                    error: Some(format!("写入失败: {}", e)),
                                });
                            } else {
                                results.push(DownloadResult {
                                    success: true,
                                    url: url.clone(),
                                    local_path: local_file_path.to_string_lossy().to_string(),
                                    file_name,
                                    file_size,
                                    error: None,
                                });
                            }
                        }
                        Err(e) => results.push(DownloadResult {
                            success: false,
                            url: url.clone(),
                            local_path: local_file_path.to_string_lossy().to_string(),
                            file_name,
                            file_size: 0,
                            error: Some(format!("接收数据失败: {}", e)),
                        }),
                    }
                } else {
                    results.push(DownloadResult {
                        success: false,
                        url: url.clone(),
                        local_path: local_file_path.to_string_lossy().to_string(),
                        file_name,
                        file_size: 0,
                        error: Some(format!("HTTP 状态码: {}", resp.status())),
                    });
                }
            }
            Err(e) => results.push(DownloadResult {
                success: false,
                url: url.clone(),
                local_path: local_file_path.to_string_lossy().to_string(),
                file_name,
                file_size: 0,
                error: Some(format!("网络请求失败: {}", e)),
            }),
        }
    }

    Ok(results)
}

/// 7. 使用 Windows 关联默认程序打开本地文件
#[tauri::command]
pub async fn open_report_local_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err("本地文件不存在或已被移除".to_string());
    }

    #[cfg(windows)]
    {
        let win_path = file_path.replace('/', "\\");
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &win_path])
            .spawn()
            .map_err(|e| format!("调用系统默认程序打开文件失败: {}", e))?;
    }

    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("打开文件失败: {}", e))?;
    }

    Ok(())
}

/// 8. 打开文件所在文件夹并在 Windows Explorer 中高亮选中该文件
#[tauri::command]
pub async fn open_report_local_folder(
    folder_path: String,
    select_file: Option<String>,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Some(file_str) = select_file {
            let file_path = PathBuf::from(&file_str);
            if file_path.exists() {
                let win_path = file_str.replace('/', "\\");
                std::process::Command::new("explorer")
                    .arg(format!("/select,{}", win_path))
                    .spawn()
                    .map_err(|e| format!("定位文件失败: {}", e))?;
                return Ok(());
            }
        }

        let folder = PathBuf::from(&folder_path);
        let target_dir = if folder.exists() {
            folder
        } else {
            folder
                .ancestors()
                .find(|p| p.exists())
                .unwrap_or(Path::new("C:\\"))
                .to_path_buf()
        };

        let win_dir = target_dir.to_string_lossy().replace('/', "\\");
        std::process::Command::new("explorer")
            .arg(win_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanAllResult {
    #[serde(rename = "cleanedItemsCount")]
    pub cleaned_items_count: usize,
    pub config: ReportStorageConfig,
}

/// 9. 清理单份体检报告在本地磁盘的下载文件与目录
#[tauri::command]
pub async fn clean_single_report_files(
    app: AppHandle,
    params: CheckReportStatusParams,
) -> Result<bool, String> {
    let (root, _) = resolve_current_root_dir(&app);
    let (customer_dir, report_dir) = build_report_dir_paths(
        &root,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
        &params.report_id,
        params.report_date.as_deref(),
        params.medical_org.as_deref(),
    );

    // 安全校验：待删除路径必须在根目录内且存在
    if report_dir.starts_with(&root) && report_dir.exists() {
        std::fs::remove_dir_all(&report_dir)
            .map_err(|e| format!("删除本地报告文件失败: {}", e))?;
    }

    // 若客户目录下已无其他报告子目录，顺带清理空的客户目录
    if customer_dir.starts_with(&root) && customer_dir.exists() {
        if let Ok(mut entries) = std::fs::read_dir(&customer_dir) {
            if entries.next().is_none() {
                let _ = std::fs::remove_dir(&customer_dir);
            }
        }
    }

    Ok(true)
}

/// 10. 清理某个客户名下的所有已归档本地报告目录与文件
#[tauri::command]
pub async fn clean_customer_report_files(
    app: AppHandle,
    customer_name: String,
    mobile: String,
    customer_id: String,
) -> Result<bool, String> {
    let (root, _) = resolve_current_root_dir(&app);
    let clean_name = sanitize_name(&customer_name);
    let mobile_tail = if mobile.len() >= 4 {
        &mobile[mobile.len() - 4..]
    } else {
        &mobile
    };
    let customer_folder_name = format!("{}_{}_{}", clean_name, mobile_tail, customer_id);
    let customer_dir = root.join(customer_folder_name);

    if customer_dir.starts_with(&root) && customer_dir.exists() {
        std::fs::remove_dir_all(&customer_dir)
            .map_err(|e| format!("删除客户所有本地报告文件失败: {}", e))?;
        return Ok(true);
    }
    Ok(false)
}

/// 11. 一键清理存储根目录下的所有本地报告缓存与文件（彻底擦除磁盘数据）
#[tauri::command]
pub async fn clean_all_report_files(app: AppHandle) -> Result<CleanAllResult, String> {
    let (root, is_custom) = resolve_current_root_dir(&app);
    let mut count = 0;
    if root.exists() {
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if std::fs::remove_dir_all(&path).is_ok() {
                        count += 1;
                    }
                } else if path.is_file() {
                    if std::fs::remove_file(&path).is_ok() {
                        count += 1;
                    }
                }
            }
        }
    }

    let free_bytes = get_disk_free_bytes(&root);
    let free_gb = (free_bytes as f64) / (1024.0 * 1024.0 * 1024.0);

    Ok(CleanAllResult {
        cleaned_items_count: count,
        config: ReportStorageConfig {
            root_path: root.to_string_lossy().to_string(),
            disk_free_bytes: free_bytes,
            disk_free_gb: (free_gb * 100.0).round() / 100.0,
            is_custom,
        },
    })
}

// =================== 健管方案本地文件管理命令 ===================

#[derive(Debug, Serialize, Deserialize)]
pub struct SchemeStatusParams {
    #[serde(rename = "customerName")]
    pub customer_name: String,
    pub mobile: String,
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "schemeId")]
    pub scheme_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchemeStatusResult {
    #[serde(rename = "customerDir")]
    pub customer_dir: String,
    #[serde(rename = "schemeDir")]
    pub scheme_dir: String,
    #[serde(rename = "localPath")]
    pub local_path: String,
    pub exists: bool,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadSchemeParams {
    #[serde(rename = "customerName")]
    pub customer_name: String,
    pub mobile: String,
    #[serde(rename = "customerId")]
    pub customer_id: String,
    #[serde(rename = "schemeId")]
    pub scheme_id: String,
    #[serde(rename = "fileUrl")]
    pub file_url: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
}

/// 12. 检查单份健管方案 PDF 是否已在本地下载归档
#[tauri::command]
pub async fn check_scheme_file_status(
    app: AppHandle,
    params: SchemeStatusParams,
) -> Result<SchemeStatusResult, String> {
    let (root_path, _) = resolve_current_root_dir(&app);
    let (customer_dir, scheme_dir) = build_scheme_dir_paths(
        &root_path,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
    );
    let local_file_path = scheme_dir.join(&params.file_name);
    let exists = local_file_path.exists() && local_file_path.is_file();
    let file_size = if exists {
        local_file_path.metadata().map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    Ok(SchemeStatusResult {
        customer_dir: customer_dir.to_string_lossy().to_string(),
        scheme_dir: scheme_dir.to_string_lossy().to_string(),
        local_path: local_file_path.to_string_lossy().to_string(),
        exists,
        file_size,
    })
}

/// 13. 下载健管方案 PDF 文件至客户专属的“健管方案”本地子目录
#[tauri::command]
pub async fn download_scheme_file(
    app: AppHandle,
    params: DownloadSchemeParams,
) -> Result<DownloadResult, String> {
    let (root_path, _) = resolve_current_root_dir(&app);
    let (_, scheme_dir) = build_scheme_dir_paths(
        &root_path,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
    );

    std::fs::create_dir_all(&scheme_dir)
        .map_err(|e| format!("创建方案存储目录失败 {:?}: {}", scheme_dir, e))?;

    let local_file_path = scheme_dir.join(&params.file_name);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(&params.file_url)
        .send()
        .await
        .map_err(|e| format!("下载方案文件失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(DownloadResult {
            success: false,
            url: params.file_url,
            local_path: local_file_path.to_string_lossy().to_string(),
            file_name: params.file_name,
            file_size: 0,
            error: Some(format!("服务器返回错误 HTTP {}", response.status())),
        });
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取方案文件流失败: {}", e))?;

    let file_size = bytes.len() as u64;
    tokio::fs::write(&local_file_path, bytes)
        .await
        .map_err(|e| format!("保存方案文件失败: {}", e))?;

    Ok(DownloadResult {
        success: true,
        url: params.file_url,
        local_path: local_file_path.to_string_lossy().to_string(),
        file_name: params.file_name,
        file_size,
        error: None,
    })
}

/// 14. 删除单份健管方案在本地电脑的下载文件
#[tauri::command]
pub async fn clean_single_scheme_file(
    app: AppHandle,
    params: SchemeStatusParams,
) -> Result<bool, String> {
    let (root, _) = resolve_current_root_dir(&app);
    let (customer_dir, scheme_dir) = build_scheme_dir_paths(
        &root,
        &params.customer_name,
        &params.mobile,
        &params.customer_id,
    );
    let local_file_path = scheme_dir.join(&params.file_name);

    if local_file_path.starts_with(&root) && local_file_path.exists() {
        std::fs::remove_file(&local_file_path)
            .map_err(|e| format!("删除本地方案文件失败: {}", e))?;
    }

    // 若方案目录已空，清理方案空目录
    if scheme_dir.starts_with(&root) && scheme_dir.exists() {
        if let Ok(mut entries) = std::fs::read_dir(&scheme_dir) {
            if entries.next().is_none() {
                let _ = std::fs::remove_dir(&scheme_dir);
            }
        }
    }

    // 若客户根目录下已无其他文件或子目录，清理客户空目录
    if customer_dir.starts_with(&root) && customer_dir.exists() {
        if let Ok(mut entries) = std::fs::read_dir(&customer_dir) {
            if entries.next().is_none() {
                let _ = std::fs::remove_dir(&customer_dir);
            }
        }
    }

    Ok(true)
}

/// 15. 读取本地或下载远程 PDF 文件的二进制字节流（彻底规避 WebView2 iframe 限制和跨域 CORS 拦截）
#[tauri::command]
pub async fn get_pdf_file_bytes(
    file_url_or_path: String,
) -> Result<Vec<u8>, String> {
    let trimmed = file_url_or_path.trim();

    // 1. 如果是本地路径且文件存在，直接从本地读取
    let local_path = PathBuf::from(trimmed);
    if local_path.is_file() && local_path.exists() {
        return tokio::fs::read(&local_path)
            .await
            .map_err(|e| format!("读取本地 PDF 文件失败: {}", e));
    }

    // 2. 如果是 HTTP/HTTPS 远程链接，通过 reqwest 后端下载字节流（无视任何跨域与 iframe 限制）
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        let response = client
            .get(trimmed)
            .send()
            .await
            .map_err(|e| format!("获取远程 PDF 失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("获取 PDF 失败，服务器返回 HTTP {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("读取 PDF 数据流失败: {}", e))?;

        return Ok(bytes.to_vec());
    }

    Err(format!("无效的 PDF 文件路径或链接: {}", trimmed))
}
