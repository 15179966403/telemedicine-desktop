import { useCallback, useEffect } from 'react'
import { useAuthStore } from '@/stores'
import { AuthService } from '@/services'
import { useErrorHandler } from '@/utils/errorHandler'
import type { LoginCredentials } from '@/types'

export function useAuth() {
  const {
    isAuthenticated,
    user,
    token,
    sessionExpires,
    loading,
    error,
    login: storeLogin,
    logout: storeLogout,
    refreshSession,
    checkSession,
    clearError,
  } = useAuthStore()

  const { handleAsyncError } = useErrorHandler()
  const authService = AuthService.getInstance()

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      return handleAsyncError(async () => {
        await storeLogin(credentials)
      })
    },
    [storeLogin, handleAsyncError]
  )

  const logout = useCallback(async () => {
    return handleAsyncError(async () => {
      await storeLogout()
    })
  }, [storeLogout, handleAsyncError])

  const validateSession = useCallback(async () => {
    return handleAsyncError(async () => {
      return await checkSession()
    }, false)
  }, [checkSession, handleAsyncError])

  const refreshToken = useCallback(async () => {
    if (!token) return

    return handleAsyncError(async () => {
      await refreshSession()
    })
  }, [token, refreshSession, handleAsyncError])

  // 检查会话是否即将过期（5分钟内）
  const isSessionExpiring = useCallback(() => {
    if (!sessionExpires) return false

    const now = new Date()
    const expiresAt = new Date(sessionExpires)
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()

    return timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0
  }, [sessionExpires])

  // 检查会话是否已过期
  const isSessionExpired = useCallback(() => {
    if (!sessionExpires) return false

    const now = new Date()
    const expiresAt = new Date(sessionExpires)

    return now > expiresAt
  }, [sessionExpires])

  // 自动会话管理
  useEffect(() => {
    if (!isAuthenticated || !token) return

    // 检查会话是否已过期
    if (isSessionExpired()) {
      console.log('Session expired, logging out')
      logout()
      return
    }

    // 如果会话即将过期，自动刷新
    if (isSessionExpiring()) {
      console.log('Session expiring soon, refreshing token')
      refreshToken().catch(() => {
        console.log('Failed to refresh token, logging out')
        logout()
      })
    }

    // 设置定时器检查会话状态
    const interval = setInterval(() => {
      if (isSessionExpired()) {
        logout()
      } else if (isSessionExpiring()) {
        refreshToken().catch(() => logout())
      }
    }, 60 * 1000) // 每分钟检查一次

    return () => clearInterval(interval)
  }, [
    isAuthenticated,
    token,
    isSessionExpired,
    isSessionExpiring,
    refreshToken,
    logout,
  ])

  // 页面可见性变化时验证会话
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && token) {
        validateSession().catch(() => {
          console.log('Session validation failed, logging out')
          logout()
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, token, validateSession, logout])

  return {
    // 状态
    isAuthenticated,
    user,
    token,
    sessionExpires,
    loading,
    error,

    // 方法
    login,
    logout,
    validateSession,
    refreshToken,
    clearError,

    // 辅助方法
    isSessionExpiring,
    isSessionExpired,
  }
}
