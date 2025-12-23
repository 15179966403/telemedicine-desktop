import { create } from 'zustand'

interface UIState {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  loading: boolean
  notifications: Notification[]
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  timestamp: Date
}

interface UIActions {
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setLoading: (loading: boolean) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  // State
  theme: 'light',
  sidebarCollapsed: false,
  loading: false,
  notifications: [],

  // Actions
  setTheme: (theme: 'light' | 'dark') => {
    set({ theme })
    // TODO: 应用主题到 DOM
    document.documentElement.setAttribute('data-theme', theme)
  },

  toggleSidebar: () => {
    const { sidebarCollapsed } = get()
    set({ sidebarCollapsed: !sidebarCollapsed })
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed })
  },

  setLoading: (loading: boolean) => {
    set({ loading })
  },

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const { notifications } = get()
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    }

    set({ notifications: [...notifications, newNotification] })

    // 自动移除通知
    if (notification.duration !== 0) {
      const duration = notification.duration || 5000
      setTimeout(() => {
        get().removeNotification(newNotification.id)
      }, duration)
    }
  },

  removeNotification: (id: string) => {
    const { notifications } = get()
    set({ notifications: notifications.filter(n => n.id !== id) })
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },
}))