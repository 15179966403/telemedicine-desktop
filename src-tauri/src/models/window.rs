// 窗口管理模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WindowType {
    Main,
    Consultation,
    #[serde(rename = "patient_detail")]
    PatientDetail,
    Settings,
    Notification,
}

impl std::fmt::Display for WindowType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WindowType::Main => write!(f, "main"),
            WindowType::Consultation => write!(f, "consultation"),
            WindowType::PatientDetail => write!(f, "patient_detail"),
            WindowType::Settings => write!(f, "settings"),
            WindowType::Notification => write!(f, "notification"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub window_type: WindowType,
    pub title: String,
    pub url: String,
    pub data: WindowData,
    pub position: WindowPosition,
    pub size: WindowSize,
    pub state: WindowState,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "lastFocused")]
    pub last_focused: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowData {
    #[serde(rename = "consultationId")]
    pub consultation_id: Option<String>,
    #[serde(rename = "patientId")]
    pub patient_id: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WindowState {
    Normal,
    Minimized,
    Maximized,
    Fullscreen,
}

impl std::fmt::Display for WindowState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WindowState::Normal => write!(f, "normal"),
            WindowState::Minimized => write!(f, "minimized"),
            WindowState::Maximized => write!(f, "maximized"),
            WindowState::Fullscreen => write!(f, "fullscreen"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    #[serde(rename = "type")]
    pub window_type: WindowType,
    pub title: String,
    pub url: String,
    pub data: Option<WindowData>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(rename = "minWidth")]
    pub min_width: Option<u32>,
    #[serde(rename = "minHeight")]
    pub min_height: Option<u32>,
    pub resizable: Option<bool>,
    pub center: Option<bool>,
    #[serde(rename = "alwaysOnTop")]
    pub always_on_top: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowEvent {
    #[serde(rename = "type")]
    pub event_type: WindowEventType,
    #[serde(rename = "windowId")]
    pub window_id: String,
    pub data: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WindowEventType {
    Created,
    Closed,
    Focused,
    Minimized,
    Maximized,
    Moved,
    Resized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowLimits {
    #[serde(rename = "maxWindows")]
    pub max_windows: u32,
    #[serde(rename = "maxConsultationWindows")]
    pub max_consultation_windows: u32,
    #[serde(rename = "memoryThreshold")]
    pub memory_threshold: u64, // MB
    #[serde(rename = "cpuThreshold")]
    pub cpu_threshold: f32, // percentage
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    #[serde(rename = "memoryUsage")]
    pub memory_usage: u64, // MB
    #[serde(rename = "cpuUsage")]
    pub cpu_usage: f32, // percentage
    #[serde(rename = "windowCount")]
    pub window_count: u32,
    #[serde(rename = "lastUpdated")]
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowLayout {
    pub id: String,
    pub name: String,
    pub windows: Vec<WindowLayoutItem>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowLayoutItem {
    #[serde(rename = "type")]
    pub window_type: WindowType,
    pub position: WindowPosition,
    pub size: WindowSize,
    pub data: Option<WindowData>,
}