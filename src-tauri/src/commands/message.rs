// 消息相关命令

use serde::{Deserialize, Serialize};
use crate::database::dao::{MessageDao, BaseDao};
use crate::models::{Message as MessageModel, MessageType, SenderType, SyncStatus, ReadStatus};
use chrono::Utc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub consultation_id: String,
    pub message_type: String, // "text" | "image" | "voice" | "file"
    pub content: String,
    pub sender: String, // "doctor" | "patient"
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Message {
    pub id: String,
    pub consultation_id: String,
    pub message_type: String,
    pub content: String,
    pub sender: String,
    pub timestamp: String,
    pub status: String, // "sending" | "sent" | "delivered" | "failed"
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MessageList {
    pub messages: Vec<Message>,
    pub total: u32,
    pub page: u32,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct FileUploadResult {
    pub url: String,
    pub path: String,
}

#[tauri::command]
pub async fn send_message(request: SendMessageRequest) -> Result<Message, String> {
    println!("Sending message: {:?}", request);

    let message_dao = MessageDao::new();
    let message_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now();

    // 解析sender_type和message_type
    let sender_type = match request.sender.as_str() {
        "doctor" => SenderType::Doctor,
        "patient" => SenderType::Patient,
        _ => return Err("Invalid sender type".to_string()),
    };

    let message_type = match request.message_type.as_str() {
        "text" => MessageType::Text,
        "image" => MessageType::Image,
        "voice" => MessageType::Voice,
        "file" => MessageType::File,
        "template" => MessageType::Template,
        _ => return Err("Invalid message type".to_string()),
    };

    // 创建消息模型
    let message_model = MessageModel {
        id: message_id.clone(),
        consultation_id: request.consultation_id.clone(),
        sender_type,
        message_type,
        content: Some(request.content.clone()),
        file_path: request.file_path.clone(),
        file_size: None,
        mime_type: None,
        timestamp,
        sync_status: SyncStatus::Pending,
        read_status: ReadStatus::Unread,
    };

    // 保存到本地数据库
    let create_result = message_dao.create(&message_model).map_err(|e| e.to_string());

    match create_result {
        Ok(_) => {
            println!("Message saved to local database: {}", message_id);

            // TODO: 实际发送到服务器的逻辑
            // 这里可以添加网络请求代码

            // 模拟发送延迟
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            // 更新同步状态为已发送
            if let Err(e) = message_dao.update_sync_status(&message_id, "synced") {
                println!("Failed to update sync status: {}", e);
            }

            let response_message = Message {
                id: message_id,
                consultation_id: request.consultation_id,
                message_type: request.message_type,
                content: request.content,
                sender: request.sender,
                timestamp: timestamp.to_rfc3339(),
                status: "sent".to_string(),
                file_path: request.file_path,
            };

            Ok(response_message)
        }
        Err(e) => {
            println!("Failed to save message to database: {}", e);
            Err(format!("保存消息失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_message_history(
    consultation_id: String,
    page: Option<u32>,
    limit: Option<u32>,
) -> Result<MessageList, String> {
    println!("Getting message history for consultation: {}, page: {:?}", consultation_id, page);

    let message_dao = MessageDao::new();
    let page = page.unwrap_or(1) as i32;
    let limit = limit.unwrap_or(20) as i32;

    match message_dao.find_by_consultation_id(&consultation_id, page, limit) {
        Ok(page_result) => {
            let messages: Vec<Message> = page_result.items.into_iter().map(|msg| {
                let sender = match msg.sender_type {
                    SenderType::Doctor => "doctor",
                    SenderType::Patient => "patient",
                }.to_string();

                let msg_type = match msg.message_type {
                    MessageType::Text => "text",
                    MessageType::Image => "image",
                    MessageType::Voice => "voice",
                    MessageType::File => "file",
                    MessageType::Template => "template",
                }.to_string();

                let status = match msg.sync_status {
                    SyncStatus::Synced => "delivered",
                    SyncStatus::Pending => "pending",
                    SyncStatus::Failed => "failed",
                }.to_string();

                Message {
                    id: msg.id,
                    consultation_id: msg.consultation_id,
                    message_type: msg_type,
                    content: msg.content.unwrap_or_default(),
                    sender,
                    timestamp: msg.timestamp.to_rfc3339(),
                    status,
                    file_path: msg.file_path,
                }
            }).collect();

            let has_more = (page_result.page as u32) < (page_result.total_pages as u32);

            let result = MessageList {
                messages,
                total: page_result.total as u32,
                page: page_result.page as u32,
                has_more,
            };

            Ok(result)
        }
        Err(e) => {
            println!("Failed to get message history: {}", e);
            Err(format!("获取消息历史失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn upload_file(file_data: Vec<u8>, file_name: String) -> Result<FileUploadResult, String> {
    println!("Uploading file: {}, size: {} bytes", file_name, file_data.len());

    // TODO: 实现实际的文件上传逻辑
    // 1. 验证文件类型和大小
    // 2. 保存到本地临时目录
    // 3. 上传到服务器或云存储

    // 模拟上传延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    // 模拟文件保存路径
    let timestamp = chrono::Utc::now().timestamp();
    let local_path = format!("/temp/uploads/{}-{}", timestamp, file_name);
    let url = format!("https://cdn.telemedicine.com/files/{}-{}", timestamp, file_name);

    let result = FileUploadResult {
        url,
        path: local_path,
    };

    Ok(result)
}

#[tauri::command]
pub async fn mark_messages_as_read(consultation_id: String) -> Result<u32, String> {
    println!("Marking messages as read for consultation: {}", consultation_id);

    let message_dao = MessageDao::new();

    match message_dao.mark_consultation_messages_as_read(&consultation_id, "doctor") {
        Ok(updated_count) => {
            println!("Marked {} messages as read", updated_count);
            Ok(updated_count as u32)
        }
        Err(e) => {
            println!("Failed to mark messages as read: {}", e);
            Err(format!("标记消息已读失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_unread_message_count(consultation_id: String) -> Result<u32, String> {
    println!("Getting unread message count for consultation: {}", consultation_id);

    let message_dao = MessageDao::new();

    match message_dao.get_unread_count(&consultation_id, "doctor") {
        Ok(count) => Ok(count as u32),
        Err(e) => {
            println!("Failed to get unread count: {}", e);
            Err(format!("获取未读消息数量失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_pending_messages() -> Result<u32, String> {
    println!("Syncing pending messages");

    let message_dao = MessageDao::new();

    let pending_result = message_dao.find_unsynced_messages();

    match pending_result {
        Ok(pending_messages) => {
            let mut synced_count = 0;

            for message in pending_messages {
                // TODO: 实际同步到服务器的逻辑
                // 这里可以添加网络请求代码

                // 模拟同步延迟
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                // 更新同步状态
                if let Ok(_) = message_dao.update_sync_status(&message.id, "synced") {
                    synced_count += 1;
                    println!("Synced message: {}", message.id);
                }
            }

            println!("Synced {} messages", synced_count);
            Ok(synced_count)
        }
        Err(e) => {
            println!("Failed to sync messages: {}", e);
            Err(format!("同步消息失败: {}", e))
        }
    }
}