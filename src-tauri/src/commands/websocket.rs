// WebSocket 相关命令

use crate::services::{WebSocketManager, QueuedMessage, ConnectionStatus};
use crate::models::MessageType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, State, Emitter};
use tokio::sync::Mutex;

// WebSocket 管理器状态
pub type WebSocketManagerState = Arc<Mutex<WebSocketManager>>;

// 连接请求
#[derive(Debug, Deserialize)]
pub struct ConnectRequest {
    pub url: String,
    pub auth_token: Option<String>,
}

// 发送消息请求
#[derive(Debug, Deserialize)]
pub struct SendWebSocketMessageRequest {
    pub connection_id: String,
    pub consultation_id: String,
    pub message_type: String,
    pub content: String,
    pub file_path: Option<String>,
}

// 订阅请求
#[derive(Debug, Deserialize)]
pub struct SubscriptionRequest {
    pub connection_id: String,
    pub consultation_id: String,
}

// 已读回执请求
#[derive(Debug, Deserialize)]
pub struct ReadReceiptRequest {
    pub connection_id: String,
    pub consultation_id: String,
    pub message_id: String,
}

// 输入状态请求
#[derive(Debug, Deserialize)]
pub struct TypingStatusRequest {
    pub connection_id: String,
    pub consultation_id: String,
    pub is_typing: bool,
}

// 连接状态响应
#[derive(Debug, Serialize)]
pub struct ConnectionStatusResponse {
    pub status: String,
    pub error_message: Option<String>,
}

impl From<ConnectionStatus> for ConnectionStatusResponse {
    fn from(status: ConnectionStatus) -> Self {
        match status {
            ConnectionStatus::Disconnected => Self {
                status: "disconnected".to_string(),
                error_message: None,
            },
            ConnectionStatus::Connecting => Self {
                status: "connecting".to_string(),
                error_message: None,
            },
            ConnectionStatus::Connected => Self {
                status: "connected".to_string(),
                error_message: None,
            },
            ConnectionStatus::Reconnecting => Self {
                status: "reconnecting".to_string(),
                error_message: None,
            },
            ConnectionStatus::Error(msg) => Self {
                status: "error".to_string(),
                error_message: Some(msg),
            },
        }
    }
}

// 创建 WebSocket 连接
#[tauri::command]
pub async fn create_websocket_connection(
    request: ConnectRequest,
    ws_manager: State<'_, WebSocketManagerState>,
    app: AppHandle,
) -> Result<String, String> {
    println!("Creating WebSocket connection to: {}", request.url);

    let manager = ws_manager.lock().await;

    match manager.create_connection(request.url, request.auth_token).await {
        Ok(connection_id) => {
            println!("WebSocket connection created: {}", connection_id);

            // 发送连接成功事件到前端
            if let Err(e) = app.emit("websocket-connected", &connection_id) {
                println!("Failed to emit websocket-connected event: {}", e);
            }

            Ok(connection_id)
        }
        Err(e) => {
            let error_msg = format!("Failed to create WebSocket connection: {}", e);
            println!("{}", error_msg);

            // 发送连接失败事件到前端
            if let Err(e) = app.emit("websocket-connection-failed", &error_msg) {
                println!("Failed to emit websocket-connection-failed event: {}", e);
            }

            Err(error_msg)
        }
    }
}

// 关闭 WebSocket 连接
#[tauri::command]
pub async fn close_websocket_connection(
    connection_id: String,
    ws_manager: State<'_, WebSocketManagerState>,
    app: AppHandle,
) -> Result<(), String> {
    println!("Closing WebSocket connection: {}", connection_id);

    let manager = ws_manager.lock().await;

    match manager.close_connection(&connection_id).await {
        Ok(_) => {
            println!("WebSocket connection closed: {}", connection_id);

            // 发送连接关闭事件到前端
            if let Err(e) = app.emit("websocket-disconnected", &connection_id) {
                println!("Failed to emit websocket-disconnected event: {}", e);
            }

            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to close WebSocket connection: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 获取 WebSocket 连接状态
#[tauri::command]
pub async fn get_websocket_connection_status(
    connection_id: String,
    ws_manager: State<'_, WebSocketManagerState>,
) -> Result<ConnectionStatusResponse, String> {
    println!("Getting WebSocket connection status: {}", connection_id);

    let manager = ws_manager.lock().await;

    match manager.get_connection_status(&connection_id).await {
        Ok(status) => Ok(status.into()),
        Err(e) => {
            let error_msg = format!("Failed to get connection status: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 获取所有 WebSocket 连接状态
#[tauri::command]
pub async fn get_all_websocket_connections_status(
    ws_manager: State<'_, WebSocketManagerState>,
) -> Result<HashMap<String, ConnectionStatusResponse>, String> {
    println!("Getting all WebSocket connections status");

    let manager = ws_manager.lock().await;
    let status_map = manager.get_all_connection_status().await;

    let response_map: HashMap<String, ConnectionStatusResponse> = status_map
        .into_iter()
        .map(|(id, status)| (id, status.into()))
        .collect();

    Ok(response_map)
}

// 通过 WebSocket 发送消息
#[tauri::command]
pub async fn send_websocket_message(
    request: SendWebSocketMessageRequest,
    ws_manager: State<'_, WebSocketManagerState>,
    app: AppHandle,
) -> Result<(), String> {
    println!("Sending WebSocket message: {:?}", request);

    // 解析消息类型
    let message_type = match request.message_type.as_str() {
        "text" => MessageType::Text,
        "image" => MessageType::Image,
        "voice" => MessageType::Voice,
        "file" => MessageType::File,
        _ => return Err("Invalid message type".to_string()),
    };

    // 创建队列消息
    let queued_message = QueuedMessage {
        id: uuid::Uuid::new_v4().to_string(),
        consultation_id: request.consultation_id.clone(),
        message_type,
        content: request.content,
        file_path: request.file_path,
        retry_count: 0,
        created_at: chrono::Utc::now(),
    };

    let manager = ws_manager.lock().await;

    match manager.send_message(&request.connection_id, queued_message.clone()).await {
        Ok(_) => {
            println!("WebSocket message sent successfully");

            // 发送消息发送成功事件到前端
            if let Err(e) = app.emit("websocket-message-sent", &queued_message.id) {
                println!("Failed to emit websocket-message-sent event: {}", e);
            }

            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to send WebSocket message: {}", e);
            println!("{}", error_msg);

            // 发送消息发送失败事件到前端
            if let Err(e) = app.emit("websocket-message-failed", &queued_message.id) {
                println!("Failed to emit websocket-message-failed event: {}", e);
            }

            Err(error_msg)
        }
    }
}

// 订阅问诊消息
#[tauri::command]
pub async fn subscribe_to_consultation(
    request: SubscriptionRequest,
    ws_manager: State<'_, WebSocketManagerState>,
) -> Result<(), String> {
    println!("Subscribing to consultation: {:?}", request);

    let manager = ws_manager.lock().await;

    match manager.subscribe_to_consultation(&request.connection_id, request.consultation_id.clone()).await {
        Ok(_) => {
            println!("Successfully subscribed to consultation: {}", request.consultation_id);
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to subscribe to consultation: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 取消订阅问诊消息
#[tauri::command]
pub async fn unsubscribe_from_consultation(
    request: SubscriptionRequest,
    ws_manager: State<'_, WebSocketManagerState>,
) -> Result<(), String> {
    println!("Unsubscribing from consultation: {:?}", request);

    let manager = ws_manager.lock().await;

    match manager.unsubscribe_from_consultation(&request.connection_id, request.consultation_id.clone()).await {
        Ok(_) => {
            println!("Successfully unsubscribed from consultation: {}", request.consultation_id);
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to unsubscribe from consultation: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 发送已读回执
#[tauri::command]
pub async fn send_read_receipt(
    request: ReadReceiptRequest,
    ws_manager: State<'_, WebSocketManagerState>,
) -> Result<(), String> {
    println!("Sending read receipt: {:?}", request);

    let manager = ws_manager.lock().await;

    match manager.send_read_receipt(&request.connection_id, request.consultation_id, request.message_id).await {
        Ok(_) => {
            println!("Read receipt sent successfully");
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to send read receipt: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 发送输入状态
#[tauri::command]
pub async fn send_typing_status(
    request: TypingStatusRequest,
    ws_manager: State<'_, WebSocketManagerState>,
) -> Result<(), String> {
    println!("Sending typing status: {:?}", request);

    let manager = ws_manager.lock().await;

    match manager.send_typing_status(&request.connection_id, request.consultation_id, request.is_typing).await {
        Ok(_) => {
            println!("Typing status sent successfully");
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to send typing status: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
}