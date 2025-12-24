/**
 * 消息通信端到端测试
 * Message Communication End-to-End Tests
 * 需求覆盖: 3.1-3.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import ConsultationPage from '@/pages/ConsultationPage'
import { useMessageStore } from '@/stores/messageStore'
import type { Message } from '@/types'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/services/webSocketService', () => ({
  webSocketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(() => true),
  },
}))

const mockMessages: Message[] = [
  {
    id: 'msg-001',
    consultationId: 'consultation-001',
    type: 'text',
    content: '医生您好，我最近感觉头痛',
    sender: 'patient',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    status: 'sent',
  },
]

describe('消息通信端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMessageStore.setState({ messages: {}, unreadCounts: {}, typing: {} })
  })

  describe('需求 3.1 - 实时消息发送和接收', () => {
    it('应该能够发送文本消息', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockMessages)
      vi.mocked(invoke).mockResolvedValueOnce({
        id: 'msg-003',
        consultationId: 'consultation-001',
        type: 'text',
        content: '大约三天了',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
      })

      render(<BrowserRouter><ConsultationPage /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('医生您好，我最近感觉头痛')).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/输入消息|请输入/i)
      await user.type(messageInput, '大约三天了')

      const sendButton = screen.getByRole('button', { name: /发送/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('send_message', expect.any(Object))
      })
    })
  })

  describe('需求 3.2 - 文件传输功能', () => {
    it('应该支持发送图片文件', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockMessages)
      vi.mocked(invoke).mockResolvedValueOnce({
        id: 'msg-006',
        type: 'image',
        content: '/uploads/image-001.jpg',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
      })

      render(<BrowserRouter><ConsultationPage /></BrowserRouter>)

      const file = new File(['image content'], 'xray.jpg', { type: 'image/jpeg' })
      const uploadButton = screen.getByLabelText(/上传文件|选择文件/i)
      await user.upload(uploadButton, file)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('upload_file', expect.any(Object))
      })
    })
  })

  describe('需求 3.3 - 消息历史记录', () => {
    it('应该能够加载历史消息', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValueOnce(mockMessages)

      render(<BrowserRouter><ConsultationPage /></BrowserRouter>)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_messages', expect.any(Object))
      })
    })
  })

  describe('需求 3.4 - 输入状态提示', () => {
    it('应该在用户输入时发送输入状态', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { webSocketService } = await import('@/services/webSocketService')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockMessages)

      render(<BrowserRouter><ConsultationPage /></BrowserRouter>)

      const messageInput = screen.getByPlaceholderText(/输入消息|请输入/i)
      await user.type(messageInput, '测试')

      await waitFor(() => {
        expect(webSocketService.send).toHaveBeenCalled()
      })
    })
  })

  describe('需求 3.5 - 消息已读状态', () => {
    it('应该标记消息为已读', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValueOnce(mockMessages)
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      render(<BrowserRouter><ConsultationPage /></BrowserRouter>)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('mark_messages_as_read', expect.any(Object))
      })
    })
  })
})
