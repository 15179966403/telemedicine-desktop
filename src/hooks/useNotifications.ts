import { useCallback } from 'react'
import { useUIStore } from '@/stores'

export function useNotifications() {
  const {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
  } = useUIStore()

  // 显示成功通知
  const showSuccess = useCallback(
    (title: string, message: string, duration?: number) => {
      addNotification({
        type: 'success',
        title,
        message,
        duration,
      })
    },
    [addNotification]
  )

  // 显示错误通知
  const showError = useCallback(
    (title: string, message: string, duration?: number) => {
      addNotification({
        type: 'error',
        title,
        message,
        duration: duration || 0, // 错误通知默认不自动消失
      })
    },
    [addNotification]
  )

  // 显示警告通知
  const showWarning = useCallback(
    (title: string, message: string, duration?: number) => {
      addNotification({
        type: 'warning',
        title,
        message,
        duration,
      })
    },
    [addNotification]
  )

  // 显示信息通知
  const showInfo = useCallback(
    (title: string, message: string, duration?: number) => {
      addNotification({
        type: 'info',
        title,
        message,
        duration,
      })
    },
    [addNotification]
  )

  // 显示加载通知
  const showLoading = useCallback(
    (title: string, message: string) => {
      const id = `loading-${Date.now()}`
      addNotification({
        type: 'info',
        title,
        message,
        duration: 0, // 不自动消失
      })
      return id
    },
    [addNotification]
  )

  // 移除通知
  const dismiss = useCallback(
    (id: string) => {
      removeNotification(id)
    },
    [removeNotification]
  )

  // 清空所有通知
  const dismissAll = useCallback(() => {
    clearNotifications()
  }, [clearNotifications])

  // 获取通知统计
  const getNotificationStats = useCallback(() => {
    const stats = notifications.reduce(
      (acc, notification) => {
        acc[notification.type] = (acc[notification.type] || 0) + 1
        acc.total++
        return acc
      },
      { total: 0, success: 0, error: 0, warning: 0, info: 0 }
    )
    return stats
  }, [notifications])

  // 检查是否有错误通知
  const hasErrors = useCallback(() => {
    return notifications.some(n => n.type === 'error')
  }, [notifications])

  // 检查是否有警告通知
  const hasWarnings = useCallback(() => {
    return notifications.some(n => n.type === 'warning')
  }, [notifications])

  // 获取最新的通知
  const getLatestNotification = useCallback(() => {
    if (notifications.length === 0) return null
    return notifications[notifications.length - 1]
  }, [notifications])

  // 获取指定类型的通知
  const getNotificationsByType = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info') => {
      return notifications.filter(n => n.type === type)
    },
    [notifications]
  )

  return {
    // 状态
    notifications,
    stats: getNotificationStats(),
    hasErrors: hasErrors(),
    hasWarnings: hasWarnings(),
    latest: getLatestNotification(),

    // 显示通知方法
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,

    // 管理通知方法
    dismiss,
    dismissAll,
    getNotificationsByType,
  }
}