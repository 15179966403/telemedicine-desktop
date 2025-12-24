/**
 * 窗口间通信服务
 * Window Inter-Communication Service
 */

import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'
import type { WindowInfo, WindowEvent } from '@/types'

// 检查是否在 Tauri 环境中运行
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

export interface WindowMessage {
  type: string
  payload: any
  sourceWindowId: string
  targetWindowId?: string // 如果为空，则广播给所有窗口
  timestamp: Date
}

export interface WindowCommunicationService {
  // 发送消息到指定窗口
  sendMessage(targetWindowId: string, type: string, payload: any): Promise<void>

  // 广播消息到所有窗口
  broadcastMessage(type: string, payload: any): Promise<void>

  // 监听消息
  onMessage(callback: (message: WindowMessage) => void): Promise<() => void>

  // 监听窗口事件
  onWindowEvent(callback: (event: WindowEvent) => void): Promise<() => void>

  // 获取当前窗口ID
  getCurrentWindowId(): Promise<string>

  // 同步数据到其他窗口
  syncData(dataType: string, data: any): Promise<void>
}

class WindowCommunicationServiceImpl implements WindowCommunicationService {
  private currentWindowId: string | null = null
  private messageListeners: Set<(message: WindowMessage) => void> = new Set()
  private eventListeners: Set<(event: WindowEvent) => void> = new Set()

  constructor() {
    this.initializeCurrentWindowId()
    this.setupEventListeners()
  }

  private async initializeCurrentWindowId(): Promise<void> {
    try {
      // 从URL参数或其他方式获取当前窗口ID
      const urlParams = new URLSearchParams(window.location.search)
      this.currentWindowId = urlParams.get('windowId') || 'main'
    } catch (error) {
      console.error('Failed to initialize window ID:', error)
      this.currentWindowId = 'main'
    }
  }

  private async setupEventListeners(): Promise<void> {
    if (!isTauri) return

    try {
      // 监听窗口间消息
      await listen('window-message', event => {
        const message = event.payload as WindowMessage
        this.messageListeners.forEach(listener => listener(message))
      })

      // 监听窗口事件
      await listen('window-event', event => {
        const windowEvent = event.payload as WindowEvent
        this.eventListeners.forEach(listener => listener(windowEvent))
      })

      // 监听窗口创建事件
      await listen('window-created', event => {
        const windowEvent: WindowEvent = {
          type: 'created',
          windowId: event.payload as string,
          timestamp: new Date(),
        }
        this.eventListeners.forEach(listener => listener(windowEvent))
      })

      // 监听窗口关闭事件
      await listen('window-closed', event => {
        const windowEvent: WindowEvent = {
          type: 'closed',
          windowId: event.payload as string,
          timestamp: new Date(),
        }
        this.eventListeners.forEach(listener => listener(windowEvent))
      })

      // 监听窗口聚焦事件
      await listen('window-focused', event => {
        const windowEvent: WindowEvent = {
          type: 'focused',
          windowId: event.payload as string,
          timestamp: new Date(),
        }
        this.eventListeners.forEach(listener => listener(windowEvent))
      })
    } catch (error) {
      console.error('Failed to setup event listeners:', error)
    }
  }

  async sendMessage(
    targetWindowId: string,
    type: string,
    payload: any
  ): Promise<void> {
    if (!isTauri) return

    const message: WindowMessage = {
      type,
      payload,
      sourceWindowId: this.currentWindowId || 'unknown',
      targetWindowId,
      timestamp: new Date(),
    }

    try {
      // 发送消息到目标窗口
      await emit('window-message', message)
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  async broadcastMessage(type: string, payload: any): Promise<void> {
    if (!isTauri) return

    const message: WindowMessage = {
      type,
      payload,
      sourceWindowId: this.currentWindowId || 'unknown',
      timestamp: new Date(),
    }

    try {
      // 广播消息到所有窗口
      await emit('window-broadcast', message)
    } catch (error) {
      console.error('Failed to broadcast message:', error)
      throw error
    }
  }

  async onMessage(
    callback: (message: WindowMessage) => void
  ): Promise<() => void> {
    this.messageListeners.add(callback)

    // 返回取消监听的函数
    return () => {
      this.messageListeners.delete(callback)
    }
  }

  async onWindowEvent(
    callback: (event: WindowEvent) => void
  ): Promise<() => void> {
    this.eventListeners.add(callback)

    // 返回取消监听的函数
    return () => {
      this.eventListeners.delete(callback)
    }
  }

  async getCurrentWindowId(): Promise<string> {
    if (!this.currentWindowId) {
      await this.initializeCurrentWindowId()
    }
    return this.currentWindowId || 'main'
  }

  async syncData(dataType: string, data: any): Promise<void> {
    await this.broadcastMessage('data-sync', {
      dataType,
      data,
      timestamp: new Date(),
    })
  }
}

// 创建单例实例
export const windowCommunicationService = new WindowCommunicationServiceImpl()

// 便捷的消息类型常量
export const MESSAGE_TYPES = {
  // 患者数据同步
  PATIENT_UPDATED: 'patient-updated',
  PATIENT_SELECTED: 'patient-selected',

  // 消息同步
  MESSAGE_RECEIVED: 'message-received',
  MESSAGE_SENT: 'message-sent',

  // 问诊状态同步
  CONSULTATION_STARTED: 'consultation-started',
  CONSULTATION_ENDED: 'consultation-ended',
  CONSULTATION_STATUS_CHANGED: 'consultation-status-changed',

  // 认证状态同步
  AUTH_STATUS_CHANGED: 'auth-status-changed',
  SESSION_EXPIRED: 'session-expired',

  // 窗口管理
  WINDOW_FOCUS_REQUEST: 'window-focus-request',
  WINDOW_CLOSE_REQUEST: 'window-close-request',

  // 数据同步
  DATA_SYNC: 'data-sync',

  // 通知消息
  NOTIFICATION: 'notification',
  ALERT: 'alert',
} as const

// 数据同步辅助函数
export const syncPatientData = async (patientData: any) => {
  await windowCommunicationService.syncData('patient', patientData)
}

export const syncMessageData = async (messageData: any) => {
  await windowCommunicationService.syncData('message', messageData)
}

export const syncConsultationData = async (consultationData: unknown) => {
  await windowCommunicationService.syncData('consultation', consultationData)
}

// 通知辅助函数
export const notifyAllWindows = async (
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) => {
  await windowCommunicationService.broadcastMessage(
    MESSAGE_TYPES.NOTIFICATION,
    {
      title,
      message,
      type,
      timestamp: new Date(),
    }
  )
}

export const alertAllWindows = async (
  title: string,
  message: string,
  type: 'warning' | 'error' = 'warning'
) => {
  await windowCommunicationService.broadcastMessage(MESSAGE_TYPES.ALERT, {
    title,
    message,
    type,
    timestamp: new Date(),
  })
}

// React Hook for window communication
export const useWindowCommunication = () => {
  const sendMessage = windowCommunicationService.sendMessage.bind(
    windowCommunicationService
  )
  const broadcastMessage = windowCommunicationService.broadcastMessage.bind(
    windowCommunicationService
  )
  const onMessage = windowCommunicationService.onMessage.bind(
    windowCommunicationService
  )
  const onWindowEvent = windowCommunicationService.onWindowEvent.bind(
    windowCommunicationService
  )
  const getCurrentWindowId = windowCommunicationService.getCurrentWindowId.bind(
    windowCommunicationService
  )
  const syncData = windowCommunicationService.syncData.bind(
    windowCommunicationService
  )

  return {
    sendMessage,
    broadcastMessage,
    onMessage,
    onWindowEvent,
    getCurrentWindowId,
    syncData,
    // 便捷方法
    syncPatientData,
    syncMessageData,
    syncConsultationData,
    notifyAllWindows,
    alertAllWindows,
  }
}
