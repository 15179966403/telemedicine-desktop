import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useUIStore } from '@/stores/uiStore'

// Mock DOM methods
Object.defineProperty(document, 'documentElement', {
  value: {
    setAttribute: vi.fn(),
  },
  writable: true,
})

// Mock setTimeout for notification auto-removal
vi.useFakeTimers()

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store state
    useUIStore.setState({
      theme: 'light',
      sidebarCollapsed: false,
      loading: false,
      notifications: [],
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useUIStore.getState()

      expect(state.theme).toBe('light')
      expect(state.sidebarCollapsed).toBe(false)
      expect(state.loading).toBe(false)
      expect(state.notifications).toEqual([])
    })
  })

  describe('Theme Management', () => {
    it('should set theme to dark', () => {
      const { setTheme } = useUIStore.getState()
      setTheme('dark')

      expect(useUIStore.getState().theme).toBe('dark')
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'dark'
      )
    })

    it('should set theme to light', () => {
      useUIStore.setState({ theme: 'dark' })

      const { setTheme } = useUIStore.getState()
      setTheme('light')

      expect(useUIStore.getState().theme).toBe('light')
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        'light'
      )
    })
  })

  describe('Sidebar Management', () => {
    it('should toggle sidebar from collapsed to expanded', () => {
      useUIStore.setState({ sidebarCollapsed: true })

      const { toggleSidebar } = useUIStore.getState()
      toggleSidebar()

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should toggle sidebar from expanded to collapsed', () => {
      useUIStore.setState({ sidebarCollapsed: false })

      const { toggleSidebar } = useUIStore.getState()
      toggleSidebar()

      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it('should set sidebar collapsed state directly', () => {
      const { setSidebarCollapsed } = useUIStore.getState()

      setSidebarCollapsed(true)
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      setSidebarCollapsed(false)
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe('Loading State', () => {
    it('should set loading state', () => {
      const { setLoading } = useUIStore.getState()

      setLoading(true)
      expect(useUIStore.getState().loading).toBe(true)

      setLoading(false)
      expect(useUIStore.getState().loading).toBe(false)
    })
  })

  describe('Notification Management', () => {
    it('should add notification', () => {
      const notification = {
        type: 'success' as const,
        title: '成功',
        message: '操作成功完成',
      }

      const { addNotification } = useUIStore.getState()
      addNotification(notification)

      const state = useUIStore.getState()
      expect(state.notifications).toHaveLength(1)

      const addedNotification = state.notifications[0]
      expect(addedNotification.type).toBe('success')
      expect(addedNotification.title).toBe('成功')
      expect(addedNotification.message).toBe('操作成功完成')
      expect(addedNotification.id).toBeDefined()
      expect(addedNotification.timestamp).toBeInstanceOf(Date)
    })

    it('should add notification with custom duration', () => {
      const notification = {
        type: 'error' as const,
        title: '错误',
        message: '操作失败',
        duration: 10000,
      }

      const { addNotification } = useUIStore.getState()
      addNotification(notification)

      const state = useUIStore.getState()
      expect(state.notifications[0].duration).toBe(10000)
    })

    it('should auto-remove notification after default duration', () => {
      const notification = {
        type: 'info' as const,
        title: '信息',
        message: '这是一条信息',
      }

      const { addNotification } = useUIStore.getState()
      addNotification(notification)

      expect(useUIStore.getState().notifications).toHaveLength(1)

      // Fast-forward time by 5 seconds (default duration)
      vi.advanceTimersByTime(5000)

      expect(useUIStore.getState().notifications).toHaveLength(0)
    })

    it('should auto-remove notification after custom duration', () => {
      const notification = {
        type: 'warning' as const,
        title: '警告',
        message: '这是一条警告',
        duration: 3000,
      }

      const { addNotification } = useUIStore.getState()
      addNotification(notification)

      expect(useUIStore.getState().notifications).toHaveLength(1)

      // Fast-forward time by 3 seconds
      vi.advanceTimersByTime(3000)

      expect(useUIStore.getState().notifications).toHaveLength(0)
    })

    it('should not auto-remove notification with duration 0', () => {
      const notification = {
        type: 'error' as const,
        title: '持久错误',
        message: '这是一条持久错误消息',
        duration: 0,
      }

      const { addNotification } = useUIStore.getState()
      addNotification(notification)

      expect(useUIStore.getState().notifications).toHaveLength(1)

      // Fast-forward time by 10 seconds
      vi.advanceTimersByTime(10000)

      // Should still be there
      expect(useUIStore.getState().notifications).toHaveLength(1)
    })

    it('should remove notification by ID', () => {
      const notification1 = {
        type: 'success' as const,
        title: '成功1',
        message: '消息1',
      }
      const notification2 = {
        type: 'info' as const,
        title: '信息2',
        message: '消息2',
      }

      const { addNotification, removeNotification } = useUIStore.getState()
      addNotification(notification1)
      addNotification(notification2)

      const state = useUIStore.getState()
      expect(state.notifications).toHaveLength(2)

      const firstNotificationId = state.notifications[0].id
      removeNotification(firstNotificationId)

      const updatedState = useUIStore.getState()
      expect(updatedState.notifications).toHaveLength(1)
      expect(updatedState.notifications[0].title).toBe('信息2')
    })

    it('should clear all notifications', () => {
      const { addNotification, clearNotifications } = useUIStore.getState()

      addNotification({ type: 'success', title: '成功', message: '消息1' })
      addNotification({ type: 'error', title: '错误', message: '消息2' })
      addNotification({ type: 'info', title: '信息', message: '消息3' })

      expect(useUIStore.getState().notifications).toHaveLength(3)

      clearNotifications()

      expect(useUIStore.getState().notifications).toHaveLength(0)
    })

    it('should handle multiple notifications with different types', () => {
      const { addNotification } = useUIStore.getState()

      addNotification({ type: 'success', title: '成功', message: '成功消息' })
      addNotification({ type: 'error', title: '错误', message: '错误消息' })
      addNotification({ type: 'warning', title: '警告', message: '警告消息' })
      addNotification({ type: 'info', title: '信息', message: '信息消息' })

      const state = useUIStore.getState()
      expect(state.notifications).toHaveLength(4)

      const types = state.notifications.map(n => n.type)
      expect(types).toContain('success')
      expect(types).toContain('error')
      expect(types).toContain('warning')
      expect(types).toContain('info')
    })
  })
})
