// 窗口管理相关命令

use serde::{Deserialize, Serialize};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Deserialize)]
pub struct CreateWindowRequest {
    pub window_type: String, // "main" | "consultation" | "patient" | "settings"
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct WindowInfo {
    pub id: String,
    pub window_type: String,
    pub title: String,
    pub data: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn create_new_window(
    app: tauri::AppHandle,
    request: CreateWindowRequest,
) -> Result<String, String> {
    println!("Creating new window: {:?}", request);

    let window_id = format!("{}-{}", request.window_type, chrono::Utc::now().timestamp());
    let title = get_window_title(&request.window_type, &request.data);
    let url = get_window_url(&request.window_type, &request.data);

    // 获取窗口配置
    let (width, height, resizable, maximizable) = get_window_config(&request.window_type);

    // 创建新窗口
    let webview_window = WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(width, height)
        .min_inner_size(600.0, 400.0)
        .resizable(resizable)
        .maximizable(maximizable)
        .center()
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    println!("Window created successfully: {}", window_id);

    Ok(window_id)
}

#[tauri::command]
pub async fn close_window_by_id(app: tauri::AppHandle, window_id: String) -> Result<(), String> {
    println!("Closing window: {}", window_id);

    if let Some(window) = app.get_webview_window(&window_id) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;
        println!("Window closed successfully: {}", window_id);
    } else {
        return Err(format!("Window not found: {}", window_id));
    }

    Ok(())
}

#[tauri::command]
pub async fn focus_window_by_id(app: tauri::AppHandle, window_id: String) -> Result<(), String> {
    println!("Focusing window: {}", window_id);

    if let Some(window) = app.get_webview_window(&window_id) {
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
        println!("Window focused successfully: {}", window_id);
    } else {
        return Err(format!("Window not found: {}", window_id));
    }

    Ok(())
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