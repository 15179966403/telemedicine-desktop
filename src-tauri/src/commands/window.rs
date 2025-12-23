// 窗口管理相关命令

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

// 全局窗口状态管理
#[derive(Debug, Default)]
pub struct WindowManagerState {
    pub windows: Mutex<HashMap<String, WindowInfo>>,
    pub limits: WindowLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowLimits {
    pub max_windows: usize,
    pub max_consultation_windows: usize,
    pub memory_threshold_mb: u64,
}

impl Default for WindowLimits {
    fn default() -> Self {
        Self {
            max_windows: 8,
            max_consultation_windows: 5,
            memory_threshold_mb: 512,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateWindowRequest {
    pub window_type: String, // "main" | "consultation" | "patient" | "settings"
    pub data: Option<serde_json::Value>,
    pub position: Option<WindowPosition>,
    pub size: Option<WindowSize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: String,
    pub window_type: String,
    pub title: String,
    pub url: String,
    pub data: Option<serde_json::Value>,
    pub position: WindowPosition,
    pub size: WindowSize,
    pub state: String, // "normal" | "minimized" | "maximized"
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_focused: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize)]
pub struct ResourceUsage {
    pub memory_usage_mb: u64,
    pub window_count: usize,
    pub consultation_window_count: usize,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[tauri::command]
pub async fn create_new_window(
    app: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
    request: CreateWindowRequest,
) -> Result<String, String> {
    println!("Creating new window: {:?}", request);

    // 检查窗口数量限制
    let windows = state.windows.lock().unwrap();
    if windows.len() >= state.limits.max_windows {
        return Err(format!("已达到最大窗口数量限制: {}", state.limits.max_windows));
    }

    // 检查特定类型窗口限制
    if request.window_type == "consultation" {
        let consultation_count = windows
            .values()
            .filter(|w| w.window_type == "consultation")
            .count();
        if consultation_count >= state.limits.max_consultation_windows {
            return Err(format!(
                "已达到最大问诊窗口数量限制: {}",
                state.limits.max_consultation_windows
            ));
        }
    }
    drop(windows);

    let window_id = format!("{}-{}", request.window_type, chrono::Utc::now().timestamp_millis());
    let title = get_window_title(&request.window_type, &request.data);
    let url = get_window_url(&request.window_type, &request.data);

    // 获取窗口配置
    let (default_width, default_height, resizable, maximizable) = get_window_config(&request.window_type);
    let width = request.size.as_ref().map(|s| s.width).unwrap_or(default_width);
    let height = request.size.as_ref().map(|s| s.height).unwrap_or(default_height);

    // 创建新窗口
    let mut builder = WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App(url.clone().into()))
        .title(&title)
        .inner_size(width, height)
        .min_inner_size(600.0, 400.0)
        .resizable(resizable)
        .maximizable(maximizable);

    // 设置窗口位置
    if let Some(pos) = &request.position {
        builder = builder.position(pos.x as f64, pos.y as f64);
    } else {
        builder = builder.center();
    }

    let webview_window = builder
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // 保存窗口信息
    let window_info = WindowInfo {
        id: window_id.clone(),
        window_type: request.window_type.clone(),
        title,
        url,
        data: request.data,
        position: request.position.unwrap_or(WindowPosition { x: 100, y: 100 }),
        size: WindowSize { width, height },
        state: "normal".to_string(),
        created_at: chrono::Utc::now(),
        last_focused: chrono::Utc::now(),
    };

    let mut windows = state.windows.lock().unwrap();
    windows.insert(window_id.clone(), window_info);

    println!("Window created successfully: {}", window_id);
    Ok(window_id)
}

#[tauri::command]
pub async fn close_window_by_id(
    app: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
    window_id: String,
) -> Result<(), String> {
    println!("Closing window: {}", window_id);

    if let Some(window) = app.get_webview_window(&window_id) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;

        // 从状态中移除窗口信息
        let mut windows = state.windows.lock().unwrap();
        windows.remove(&window_id);

        println!("Window closed successfully: {}", window_id);
    } else {
        return Err(format!("Window not found: {}", window_id));
    }

    Ok(())
}

#[tauri::command]
pub async fn focus_window_by_id(
    app: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
    window_id: String,
) -> Result<(), String> {
    println!("Focusing window: {}", window_id);

    if let Some(window) = app.get_webview_window(&window_id) {
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;

        // 更新最后聚焦时间
        let mut windows = state.windows.lock().unwrap();
        if let Some(window_info) = windows.get_mut(&window_id) {
            window_info.last_focused = chrono::Utc::now();
        }

        println!("Window focused successfully: {}", window_id);
    } else {
        return Err(format!("Window not found: {}", window_id));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_all_windows(
    state: State<'_, WindowManagerState>,
) -> Result<Vec<WindowInfo>, String> {
    let windows = state.windows.lock().unwrap();
    Ok(windows.values().cloned().collect())
}

#[tauri::command]
pub async fn get_window_info(
    state: State<'_, WindowManagerState>,
    window_id: String,
) -> Result<Option<WindowInfo>, String> {
    let windows = state.windows.lock().unwrap();
    Ok(windows.get(&window_id).cloned())
}

#[tauri::command]
pub async fn update_window_data(
    state: State<'_, WindowManagerState>,
    window_id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let mut windows = state.windows.lock().unwrap();
    if let Some(window_info) = windows.get_mut(&window_id) {
        window_info.data = Some(data);
        Ok(())
    } else {
        Err(format!("Window not found: {}", window_id))
    }
}

#[tauri::command]
pub async fn get_resource_usage(
    state: State<'_, WindowManagerState>,
) -> Result<ResourceUsage, String> {
    let windows = state.windows.lock().unwrap();
    let consultation_count = windows
        .values()
        .filter(|w| w.window_type == "consultation")
        .count();

    // 简化的内存使用计算（实际应用中可以使用系统API获取真实数据）
    let estimated_memory = windows.len() as u64 * 50; // 每个窗口估算50MB

    Ok(ResourceUsage {
        memory_usage_mb: estimated_memory,
        window_count: windows.len(),
        consultation_window_count: consultation_count,
        last_updated: chrono::Utc::now(),
    })
}

#[tauri::command]
pub async fn check_window_limits(
    state: State<'_, WindowManagerState>,
) -> Result<bool, String> {
    let windows = state.windows.lock().unwrap();
    let can_create = windows.len() < state.limits.max_windows;
    Ok(can_create)
}

#[tauri::command]
pub async fn minimize_window(
    app: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
    window_id: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_id) {
        window.minimize().map_err(|e| format!("Failed to minimize window: {}", e))?;

        // 更新窗口状态
        let mut windows = state.windows.lock().unwrap();
        if let Some(window_info) = windows.get_mut(&window_id) {
            window_info.state = "minimized".to_string();
        }

        Ok(())
    } else {
        Err(format!("Window not found: {}", window_id))
    }
}

#[tauri::command]
pub async fn maximize_window(
    app: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
    window_id: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_id) {
        window.maximize().map_err(|e| format!("Failed to maximize window: {}", e))?;

        // 更新窗口状态
        let mut windows = state.windows.lock().unwrap();
        if let Some(window_info) = windows.get_mut(&window_id) {
            window_info.state = "maximized".to_string();
        }

        Ok(())
    } else {
        Err(format!("Window not found: {}", window_id))
    }
}

fn get_window_title(window_type: &str, data: &Option<serde_json::Value>) -> String {
    match window_type {
        "main" => "互联网医院 - 工作台".to_string(),
        "consultation" => {
            if let Some(data) = data {
                if let Some(patient_name) = data.get("patientName").and_then(|v| v.as_str()) {
                    format!("问诊 - {}", patient_name)
                } else {
                    "问诊窗口".to_string()
                }
            } else {
                "问诊窗口".to_string()
            }
        }
        "patient" => {
            if let Some(data) = data {
                if let Some(patient_name) = data.get("patientName").and_then(|v| v.as_str()) {
                    format!("患者详情 - {}", patient_name)
                } else {
                    "患者管理".to_string()
                }
            } else {
                "患者管理".to_string()
            }
        }
        "settings" => "设置".to_string(),
        _ => "互联网医院".to_string(),
    }
}

fn get_window_url(window_type: &str, data: &Option<serde_json::Value>) -> String {
    match window_type {
        "main" => "/".to_string(),
        "consultation" => {
            if let Some(data) = data {
                if let Some(consultation_id) = data.get("consultationId").and_then(|v| v.as_str()) {
                    format!("/consultation/{}", consultation_id)
                } else {
                    "/consultation".to_string()
                }
            } else {
                "/consultation".to_string()
            }
        }
        "patient" => {
            if let Some(data) = data {
                if let Some(patient_id) = data.get("patientId").and_then(|v| v.as_str()) {
                    format!("/patient/{}", patient_id)
                } else {
                    "/patient".to_string()
                }
            } else {
                "/patient".to_string()
            }
        }
        "settings" => "/settings".to_string(),
        _ => "/".to_string(),
    }
}

fn get_window_config(window_type: &str) -> (f64, f64, bool, bool) {
    match window_type {
        "main" => (1200.0, 800.0, true, true),
        "consultation" => (800.0, 600.0, true, true),
        "patient" => (900.0, 700.0, true, true),
        "settings" => (600.0, 500.0, false, false),
        _ => (800.0, 600.0, true, true),
    }
}