import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ChatInterface } from '@/components/ChatInterface'
import { useMessages } from '@/hooks/useMessages'
import type { Message } from '@/types'

// Mock the useMessages hook
vi.mock('@/hooks/useMessages')

// Mock Ant Design message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
    },
  }
})

const mockUseMessages = vi.mocked(useMessages)

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    consultationId: 'consultation-1',
    type: 'text',
    content: '医生您好，我最近感觉头痛',
    sender: 'patient',
    timestamp: new Date('2024-01-20T10:00:00'),
    status: 'delivered',
  },
  {
    id: 'msg-2',
    consultationId: 'consultation-1',
    type: 'text',
    content: '您好，请问头痛持续多长时间了？',
    sender: 'doctor',
    timestamp: new Date('2024-01-20T10:02:00'),
    status: 'sent',
  },
]

const defaultMockReturn = {
  messages: mockMessages,
  unreadCount: 0,
  loading: false,
  loadingMore: false,
  error: null,
  isActive: true,
  connectionStatus: 'connected' as const,
  hasMoreMessages: false,
  currentPage: 1,
  sendMessage: vi.fn(),
  retryMessage: vi.fn(),
  loadMoreMessages: vi.fn(),
  uploadFile: vi.fn(),
  sendFileMessage: vi.fn(),
  markMessageAsRead: vi.fn(),
  setActiveChat: vi.fn(),
  clearError: vi.fn(),
  retryAllFailedMessages: vi.fn(),
  syncAllMessages: vi.fn(),
  subscribeToMessages: vi.fn(),
  unsubscribeFromMessages: vi.fn(),
  messageStats: {
    totalUnread: 0,
    totalConversations: 1,
    activeConversations: 1,
    failedMessages: 0,
    sendingCount: 0,
    hasMoreMessages: false,
    currentPage: 1,
  },
}

describe('ChatInterface', () => {
  beforeEach(() => {
    mockUseMessages.mockReturnValue(defaultMockReturn)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders chat interface with patient name', () => {
    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    expect(screen.getByText('与 张三 的对话')).toBeInTheDocument()
    expect(screen.getByText('问诊ID: consultation-1')).toBeInTheDocument()
  })

  it('displays messages correctly', () => {
    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    expect(screen.getByText('医生您好，我最近感觉头痛')).toBeInTheDocument()
    expect(
      screen.getByText('您好，请问头痛持续多长时间了？')
    ).toBeInTheDocument()
  })

  it('shows loading state when loading messages', () => {
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      loading: true,
      messages: [],
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    expect(screen.getByText('加载消息中...')).toBeInTheDocument()
  })

  it('shows empty state when no messages', () => {
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      messages: [],
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    expect(screen.getByText('暂无消息')).toBeInTheDocument()
  })

  it('displays error message when there is an error', () => {
    const mockClearError = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      error: '网络连接失败',
      clearError: mockClearError,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    expect(screen.getByText('网络连接失败')).toBeInTheDocument()

    const closeButton = screen.getByRole('button', { name: '关闭' })
    fireEvent.click(closeButton)
    expect(mockClearError).toHaveBeenCalled()
  })

  it('sends message when user types and presses enter', async () => {
    const user = userEvent.setup()
    const mockSendMessage = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      sendMessage: mockSendMessage,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const input = screen.getByPlaceholderText('输入消息内容...')
    const sendButton = screen.getByRole('button', { name: '发送' })

    await user.type(input, '这是一条测试消息')
    await user.click(sendButton)

    expect(mockSendMessage).toHaveBeenCalledWith({
      consultationId: 'consultation-1',
      type: 'text',
      content: '这是一条测试消息',
      sender: 'doctor',
    })
  })

  it('sends message when user presses Enter key', async () => {
    const user = userEvent.setup()
    const mockSendMessage = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      sendMessage: mockSendMessage,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const input = screen.getByPlaceholderText('输入消息内容...')

    await user.type(input, '这是一条测试消息')
    await user.keyboard('{Enter}')

    expect(mockSendMessage).toHaveBeenCalledWith({
      consultationId: 'consultation-1',
      type: 'text',
      content: '这是一条测试消息',
      sender: 'doctor',
    })
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    const mockSendMessage = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      sendMessage: mockSendMessage,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const sendButton = screen.getByRole('button', { name: '发送' })
    expect(sendButton).toBeDisabled()

    await user.click(sendButton)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('shows load more button when there are more messages', () => {
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      messages: new Array(25).fill(null).map((_, i) => ({
        ...mockMessages[0],
        id: `msg-${i}`,
      })),
      hasMoreMessages: true,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    expect(screen.getByText('加载更多历史消息')).toBeInTheDocument()
  })

  it('loads more messages when load more button is clicked', async () => {
    const user = userEvent.setup()
    const mockLoadMoreMessages = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      messages: new Array(25).fill(null).map((_, i) => ({
        ...mockMessages[0],
        id: `msg-${i}`,
      })),
      hasMoreMessages: true,
      loadMoreMessages: mockLoadMoreMessages,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const loadMoreButton = screen.getByText('加载更多历史消息')
    await user.click(loadMoreButton)

    expect(mockLoadMoreMessages).toHaveBeenCalled()
  })

  it('syncs messages when refresh button is clicked', async () => {
    const user = userEvent.setup()
    const mockSyncAllMessages = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      syncAllMessages: mockSyncAllMessages,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const refreshButton = screen.getByRole('button', { name: '刷新消息' })
    await user.click(refreshButton)

    expect(mockSyncAllMessages).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnClose = vi.fn()

    render(
      <ChatInterface
        consultationId="consultation-1"
        patientName="张三"
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByRole('button', { name: '关闭' })
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('handles file upload', async () => {
    const user = userEvent.setup()
    const mockSendFileMessage = vi.fn()
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      sendFileMessage: mockSendFileMessage,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const uploadButton = screen.getByText('附件')
    const input = uploadButton
      .closest('.ant-upload')
      ?.querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file)
      expect(mockSendFileMessage).toHaveBeenCalledWith(file)
    }
  })

  it('disables input and buttons when loading', () => {
    mockUseMessages.mockReturnValue({
      ...defaultMockReturn,
      loading: true,
    })

    render(<ChatInterface consultationId="consultation-1" patientName="张三" />)

    const input = screen.getByPlaceholderText('输入消息内容...')
    const sendButton = screen.getByRole('button', { name: '发送' })

    expect(input).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })
})
