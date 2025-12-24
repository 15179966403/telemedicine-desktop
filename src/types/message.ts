/**
 * 消息通信相关类型定义
 * Message communication related type definitions
 */

// 消息类型
export interface Message {
  id: string
  consultationId: string
  type: MessageType
  content: string
  sender: MessageSender
  timestamp: Date
  status: MessageStatus
  fileInfo?: FileInfo
  replyTo?: string
}

// 消息类型枚举
export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'template'

// 发送者类型
export type MessageSender = 'doctor' | 'patient'

// 消息状态
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

// 文件信息
export interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  url: string
  localPath?: string
  thumbnail?: string
}

// 消息列表响应
export interface MessageList {
  messages: Message[]
  total: number
  page: number
  hasMore: boolean
}

// 消息回调函数
export type MessageCallback = (message: Message) => void

// 问诊会话
export interface Consultation {
  id: string
  patientId: string
  patientName: string
  patientAvatar?: string
  doctorId: string
  type: ConsultationType
  status: ConsultationStatus
  title: string
  description: string
  symptoms: string[]
  attachments: FileInfo[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  lastMessage?: Message
  unreadCount: number
  priority: 'low' | 'normal' | 'high' | 'urgent'
  estimatedDuration?: number // 预计问诊时长（分钟）
  actualDuration?: number // 实际问诊时长（分钟）
}

// 问诊类型
export type ConsultationType = 'text' | 'video' | 'phone'

// 问诊状态
export type ConsultationStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired'

// 医嘱模板
export interface MedicalTemplate {
  id: string
  category: string
  title: string
  content: string
  tags: string[]
  usageCount: number
  createdAt: Date
}

// 消息发送请求
export interface SendMessageRequest {
  consultationId: string
  type: MessageType
  content: string
  fileId?: string
  replyTo?: string
}

// 消息服务接口
export interface MessageService {
  sendMessage(request: SendMessageRequest): Promise<Message>
  getMessageHistory(consultationId: string, page: number): Promise<MessageList>
  subscribeToMessages(
    consultationId: string,
    callback: MessageCallback
  ): () => void
  uploadFile(file: File): Promise<FileInfo>
  markAsRead(consultationId: string, messageIds: string[]): Promise<void>
  getTemplates(category?: string): Promise<MedicalTemplate[]>
}

// 问诊服务接口
export interface ConsultationService {
  getPendingConsultations(): Promise<Consultation[]>
  getConsultationDetail(consultationId: string): Promise<Consultation>
  acceptConsultation(consultationId: string): Promise<void>
  completeConsultation(consultationId: string, summary?: string): Promise<void>
  updateConsultationStatus(
    consultationId: string,
    status: ConsultationStatus
  ): Promise<void>
  getConsultationHistory(
    doctorId: string,
    page: number
  ): Promise<{
    consultations: Consultation[]
    total: number
    page: number
  }>
}

// 消息状态管理
export interface MessageState {
  conversations: Map<string, Message[]>
  consultations: Consultation[]
  activeConsultation: string | null
  unreadCounts: Map<string, number>
  templates: MedicalTemplate[]
  loading: boolean
  error: string | null
  connectionStatus: ConnectionStatus
}

// 连接状态
export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'

// WebSocket 事件
export interface WebSocketEvent {
  type: 'message' | 'consultation_update' | 'typing' | 'read_receipt'
  data: any
  timestamp: Date
}

// 消息队列项
export interface MessageQueueItem {
  id: string
  message: SendMessageRequest
  retryCount: number
  createdAt: Date
}
