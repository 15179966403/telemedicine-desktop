import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageService } from '@/services/messageService'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    id: 'msg-123',
    consultation_id: 'consultation-1',
    message_type: 'text',
    content: '测试消息',
    sender: 'doctor',
    timestamp: new Date().toISOString(),
    status: 'sent',
  }),
}))

describe('MessageService Basic Functionality', () => {
  let messageService: MessageService

  beforeEach(() => {
    // Reset singleton
    MessageService['instance'] = undefined as any
    messageService = MessageService.getInstance()
  })

  it('should create singleton instance', () => {
    const instance1 = MessageService.getInstance()
    const instance2 = MessageService.getInstance()

    expect(instance1).toBe(instance2)
  })

  it('should start with online status', () => {
    expect(messageService.getOnlineStatus()).toBe(true)
  })

  it('should allow setting online status', () => {
    messageService.setOnlineStatus(false)
    expect(messageService.getOnlineStatus()).toBe(false)

    messageService.setOnlineStatus(true)
    expect(messageService.getOnlineStatus()).toBe(true)
  })

  it('should start with empty message queue', () => {
    expect(messageService.getQueuedMessageCount()).toBe(0)
  })

  it('should allow subscribing to messages', () => {
    const callback = vi.fn()
    const unsubscribe = messageService.subscribeToMessages(
      'consultation-1',
      callback
    )

    expect(typeof unsubscribe).toBe('function')

    // Clean up
    unsubscribe()
  })

  it('should handle offline message queueing', async () => {
    messageService.setOnlineStatus(false)

    const message = {
      consultationId: 'consultation-1',
      type: 'text' as const,
      content: '离线消息',
      sender: 'doctor' as const,
    }

    try {
      await messageService.sendMessage('consultation-1', message)
    } catch (error: any) {
      expect(error.message).toBe('网络连接异常，消息已加入发送队列')
    }

    expect(messageService.getQueuedMessageCount()).toBe(1)
  })
})
