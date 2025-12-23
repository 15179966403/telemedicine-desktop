import { useCallback } from 'react'
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
      await authService.logout()
      storeLogout()
    })
  }, [storeLogout, authService, handleAsyncError])

  const checkSession = useCallback(async () => {
    if (!token) return false

    return handleAsyncError(
      async () => {
        const isValid = await authService.validateSession(token)
        if (!isValid) {
          storeLogout()
          return false
        }
        return true
      },
      false
    )
  }, [token, authService, storeLogout, handleAsyncError])

  const refreshToken = useCallback(async () => {
    if (!token) return

    return handleAsyncError(async () => {
      await refreshSession()
    })
  }, [token, refreshSession, handleAsyncError])

  // 检查会话是否即将过期
  const isSessionExpiring = useCallback(() => {
    if (!sessionExpires) return false

    const now = new Date()
    const expiresAt = new Date(sessionExpires)
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()

    // 如果5分钟内过期，认为即将过期
    return timeUntilExpiry < 5 * 60 * 1000
  }, [sessionExpires])

  // 检查会话是否已过期
  const isSessionExpired = useCallback(() => {
    if (!sessionExpires) return false

    const now = new Date()
    const expiresAt = new Date(sessionExpires)

    return now > expiresAt
  }, [sessionExpires])

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
    checkSession,
    refreshToken,
    clearError,

    // 辅助方法
    isSessionExpiring,
    isSessionExpired,
  }
}