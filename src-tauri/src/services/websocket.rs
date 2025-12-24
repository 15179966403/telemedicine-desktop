// WebSocket 实时通信服务
use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

use crate::models::{Message, MessageType, SenderType, SyncStatus, ReadStatus};

// WebSocket 连接状态
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error(String),
}

// WebSocket 事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketEvent {
    #[serde(rename = "message")]
    Message {
        consultation_id: String,
        message: Message,
    },
    #[serde(rename = "consultation_update")]
    ConsultationUpdate {
        consultation_id: String,
        status: String,
    },
    #[serde(rename = "typing")]
    Typing {
        consultation_id: String,
        user_id: String,
        is_typing: bool,
    },
    #[serde(rename = "read_receipt")]
    ReadReceipt {
        consultation_id: String,
        message_id: String,
        read_by: String,
    },
    #[serde(rename = "connection_ack")]
    ConnectionAck {
        user_id: String,
        session_id: String,
    },
    #[serde(rename = "error")]
    Error {
        code: String,
        message: String,
    },
}

// 消息队列项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedMessage {
    pub id: String,
    pub consultation_id: String,
    pub message_type: MessageType,
    pub content: String,
    pub file_path: Option<String>,
    pub retry_count: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// WebSocket 客户端
pub struct WebSocketClient {
    url: String,
    auth_token: Option<String>,
    connection_status: Arc<RwLock<ConnectionStatus>>,
    event_sender: mpsc::UnboundedSender<WebSocketEvent>,
    message_queue: Arc<Mutex<Vec<QueuedMessage>>>,
    reconnect_attempts: Arc<Mutex<u32>>,
    max_reconnect_attempts: u32,
    reconnect_delay: std::time::Duration,
}

impl WebSocketClient {
    pub fn new(url: String) -> (Self, mpsc::UnboundedReceiver<WebSocketEvent>) {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();

        let client = Self {
            url,
            auth_token: None,
            connection_status: Arc::new(RwLock::new(ConnectionStatus::Disconnected)),
            event_sender,
            message_queue: Arc::new(Mutex::new(Vec::new())),
            reconnect_attempts: Arc::new(Mutex::new(0)),
            max_reconnect_attempts: 5,
            reconnect_delay: std::time::Duration::from_secs(2),
        };

        (client, event_receiver)
    }

    // 设置认证令牌
    pub fn set_auth_token(&mut self, token: String) {
        self.auth_token = Some(token);
    }

    // 获取连接状态
    pub async fn get_connection_status(&self) -> ConnectionStatus {
        self.connection_status.read().await.clone()
    }

    // 连接到 WebSocket 服务器
    pub async fn connect(&self) -> Result<()> {
        self.set_connection_status(ConnectionStatus::Connecting).await;

        // 添加认证参数到 URL
        let mut url_string = self.url.clone();
        if let Some(token) = &self.auth_token {
            let separator = if url_string.contains('?') { "&" } else { "?" };
            url_string = format!("{}{}token={}", url_string, separator, token);
        }

        match connect_async(&url_string).await {
            Ok((ws_stream, _)) => {
                self.set_connection_status(ConnectionStatus::Connected).await;
                self.reset_reconnect_attempts().await;

                // 启动消息处理循环
                self.start_message_loop(ws_stream).await;

                Ok(())
            }
            Err(e) => {
                let error_msg = format!("WebSocket connection failed: {}", e);
                self.set_connection_status(ConnectionStatus::Error(error_msg.clone())).await;
                Err(anyhow!(error_msg))
            }
        }
    }

    // 断开连接
    pub async fn disconnect(&self) {
        self.set_connection_status(ConnectionStatus::Disconnected).await;
    }

    // 发送消息
    pub async fn send_message(&self, message: QueuedMessage) -> Result<()> {
        let status = self.get_connection_status().await;

        if status != ConnectionStatus::Connected {
            // 如果未连接，添加到队列
            self.add_to_queue(message).await;
            return Err(anyhow!("WebSocket not connected, message queued"));
        }

        // 构建 WebSocket 消息
        let ws_event = WebSocketEvent::Message {
            consultation_id: message.consultation_id.clone(),
            message: Message {
                id: message.id.clone(),
                consultation_id: message.consultation_id.clone(),
                sender_type: SenderType::Doctor, // 假设医生端发送
                message_type: message.message_type.clone(),
                content: Some(message.content.clone()),
                file_path: message.file_path.clone(),
                file_size: None,
                mime_type: None,
                timestamp: message.created_at,
                sync_status: SyncStatus::Pending,
                read_status: ReadStatus::Unread,
            },
        };

        let json_message = serde_json::to_string(&ws_event)?;

        // 这里需要实际的发送逻辑，暂时模拟
        println!("Sending WebSocket message: {}", json_message);

        Ok(())
    }

    // 订阅问诊消息
    pub async fn subscribe_to_consultation(&self, consultation_id: String) -> Result<()> {
        let subscribe_event = serde_json::json!({
            "type": "subscribe",
            "consultation_id": consultation_id
        });

        let json_message = serde_json::to_string(&subscribe_event)?;
        println!("Subscribing to consultation: {}", json_message);

        Ok(())
    }

    // 取消订阅问诊消息
    pub async fn unsubscribe_from_consultation(&self, consultation_id: String) -> Result<()> {
        let unsubscribe_event = serde_json::json!({
            "type": "unsubscribe",
            "consultation_id": consultation_id
        });

        let json_message = serde_json::to_string(&unsubscribe_event)?;
        println!("Unsubscribing from consultation: {}", json_message);

        Ok(())
    }

    // 发送已读回执
    pub async fn send_read_receipt(&self, consultation_id: String, message_id: String) -> Result<()> {
        let receipt_event = WebSocketEvent::ReadReceipt {
            consultation_id,
            message_id,
            read_by: "doctor".to_string(), // 假设医生端
        };

        let json_message = serde_json::to_string(&receipt_event)?;
        println!("Sending read receipt: {}", json_message);

        Ok(())
    }

    // 发送输入状态
    pub async fn send_typing_status(&self, consultation_id: String, is_typing: bool) -> Result<()> {
        let typing_event = WebSocketEvent::Typing {
            consultation_id,
            user_id: "doctor".to_string(), // 假设医生端
            is_typing,
        };

        let json_message = serde_json::to_string(&typing_event)?;
        println!("Sending typing status: {}", json_message);

        Ok(())
    }

    // 处理离线消息队列
    pub async fn process_message_queue(&self) -> Result<()> {
        let mut queue = self.message_queue.lock().await;
        let mut processed_messages = Vec::new();

        for message in queue.iter() {
            match self.send_message(message.clone()).await {
                Ok(_) => {
                    processed_messages.push(message.id.clone());
                    println!("Queued message sent: {}", message.id);
                }
                Err(e) => {
                    println!("Failed to send queued message {}: {}", message.id, e);
                    break; // 停止处理剩余消息
                }
            }
        }

        // 移除已成功发送的消息
        queue.retain(|msg| !processed_messages.contains(&msg.id));

        Ok(())
    }

    // 获取队列中的消息数量
    pub async fn get_queued_message_count(&self) -> usize {
        self.message_queue.lock().await.len()
    }

    // 清空消息队列
    pub async fn clear_message_queue(&self) {
        self.message_queue.lock().await.clear();
    }

    // 私有方法：设置连接状态
    async fn set_connection_status(&self, status: ConnectionStatus) {
        *self.connection_status.write().await = status;
    }

    // 私有方法：添加消息到队列
    async fn add_to_queue(&self, message: QueuedMessage) {
        let mut queue = self.message_queue.lock().await;
        queue.push(message);
        println!("Message added to queue, total queued: {}", queue.len());
    }

    // 私有方法：重置重连尝试次数
    async fn reset_reconnect_attempts(&self) {
        *self.reconnect_attempts.lock().await = 0;
    }

    // 私有方法：增加重连尝试次数
    async fn increment_reconnect_attempts(&self) -> u32 {
        let mut attempts = self.reconnect_attempts.lock().await;
        *attempts += 1;
        *attempts
    }

    // 私有方法：启动消息处理循环
    async fn start_message_loop(&self, ws_stream: tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>) {
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let event_sender = self.event_sender.clone();
        let connection_status = self.connection_status.clone();

        // 启动接收消息的任务
        let receive_task = tokio::spawn(async move {
            while let Some(message) = ws_receiver.next().await {
                match message {
                    Ok(WsMessage::Text(text)) => {
                        if let Ok(event) = serde_json::from_str::<WebSocketEvent>(&text) {
                            if let Err(e) = event_sender.send(event) {
                                println!("Failed to send event to handler: {}", e);
                                break;
                            }
                        } else {
                            println!("Failed to parse WebSocket message: {}", text);
                        }
                    }
                    Ok(WsMessage::Close(_)) => {
                        println!("WebSocket connection closed by server");
                        break;
                    }
                    Err(e) => {
                        println!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }

            // 连接断开，更新状态
            *connection_status.write().await = ConnectionStatus::Disconnected;
        });

        // 处理队列中的消息
        if let Err(e) = self.process_message_queue().await {
            println!("Failed to process message queue: {}", e);
        }

        // 等待接收任务完成
        if let Err(e) = receive_task.await {
            println!("Receive task error: {}", e);
        }

        // 尝试重连
        self.attempt_reconnect().await;
    }

    // 私有方法：尝试重连
    async fn attempt_reconnect(&self) {
        let attempts = self.increment_reconnect_attempts().await;

        if attempts <= self.max_reconnect_attempts {
            self.set_connection_status(ConnectionStatus::Reconnecting).await;

            println!("Attempting to reconnect ({}/{})", attempts, self.max_reconnect_attempts);

            tokio::time::sleep(self.reconnect_delay * attempts).await;

            if let Err(e) = self.connect().await {
                println!("Reconnection attempt {} failed: {}", attempts, e);
            }
        } else {
            let error_msg = format!("Max reconnection attempts ({}) exceeded", self.max_reconnect_attempts);
            self.set_connection_status(ConnectionStatus::Error(error_msg)).await;
        }
    }
}

// WebSocket 管理器
pub struct WebSocketManager {
    clients: Arc<Mutex<HashMap<String, Arc<WebSocketClient>>>>,
    event_handlers: Arc<Mutex<Vec<mpsc::UnboundedSender<WebSocketEvent>>>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            event_handlers: Arc::new(Mutex::new(Vec::new())),
        }
    }

    // 创建新的 WebSocket 连接
    pub async fn create_connection(&self, url: String, auth_token: Option<String>) -> Result<String> {
        let connection_id = uuid::Uuid::new_v4().to_string();
        let (mut client, event_receiver) = WebSocketClient::new(url);

        if let Some(token) = auth_token {
            client.set_auth_token(token);
        }

        let client_arc = Arc::new(client);

        // 存储客户端
        self.clients.lock().await.insert(connection_id.clone(), client_arc.clone());

        // 启动事件处理
        self.start_event_handler(event_receiver).await;

        // 尝试连接
        if let Err(e) = client_arc.connect().await {
            self.clients.lock().await.remove(&connection_id);
            return Err(e);
        }

        Ok(connection_id)
    }

    // 关闭连接
    pub async fn close_connection(&self, connection_id: &str) -> Result<()> {
        if let Some(client) = self.clients.lock().await.remove(connection_id) {
            client.disconnect().await;
            Ok(())
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 获取连接状态
    pub async fn get_connection_status(&self, connection_id: &str) -> Result<ConnectionStatus> {
        if let Some(client) = self.clients.lock().await.get(connection_id) {
            Ok(client.get_connection_status().await)
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 发送消息
    pub async fn send_message(&self, connection_id: &str, message: QueuedMessage) -> Result<()> {
        if let Some(client) = self.clients.lock().await.get(connection_id) {
            client.send_message(message).await
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 订阅问诊
    pub async fn subscribe_to_consultation(&self, connection_id: &str, consultation_id: String) -> Result<()> {
        if let Some(client) = self.clients.lock().await.get(connection_id) {
            client.subscribe_to_consultation(consultation_id).await
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 取消订阅问诊
    pub async fn unsubscribe_from_consultation(&self, connection_id: &str, consultation_id: String) -> Result<()> {
        if let Some(client) = self.clients.lock().await.get(connection_id) {
            client.unsubscribe_from_consultation(consultation_id).await
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 发送已读回执
    pub async fn send_read_receipt(&self, connection_id: &str, consultation_id: String, message_id: String) -> Result<()> {
        if let Some(client) = self.clients.lock().await.get(connection_id) {
            client.send_read_receipt(consultation_id, message_id).await
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 发送输入状态
    pub async fn send_typing_status(&self, connection_id: &str, consultation_id: String, is_typing: bool) -> Result<()> {
        if let Some(client) = self.clients.lock().await.get(connection_id) {
            client.send_typing_status(consultation_id, is_typing).await
        } else {
            Err(anyhow!("Connection not found: {}", connection_id))
        }
    }

    // 获取所有连接的状态
    pub async fn get_all_connection_status(&self) -> HashMap<String, ConnectionStatus> {
        let mut status_map = HashMap::new();
        let clients = self.clients.lock().await;

        for (id, client) in clients.iter() {
            status_map.insert(id.clone(), client.get_connection_status().await);
        }

        status_map
    }

    // 添加事件处理器
    pub async fn add_event_handler(&self, sender: mpsc::UnboundedSender<WebSocketEvent>) {
        self.event_handlers.lock().await.push(sender);
    }

    // 私有方法：启动事件处理
    async fn start_event_handler(&self, mut event_receiver: mpsc::UnboundedReceiver<WebSocketEvent>) {
        let handlers = self.event_handlers.clone();

        tokio::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                let handlers_guard = handlers.lock().await;

                // 广播事件到所有处理器
                for handler in handlers_guard.iter() {
                    if let Err(e) = handler.send(event.clone()) {
                        println!("Failed to send event to handler: {}", e);
                    }
                }
            }
        });
    }
}

impl Default for WebSocketManager {
    fn default() -> Self {
        Self::new()
    }
}