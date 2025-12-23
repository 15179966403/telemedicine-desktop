import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthService } from '@/services'
import type { User, LoginCredentials } from '@/types'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  sessionExpires: Date | null
  loading: boolean
  error: string | null
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string, expiresAt: Date) => void
  clearError: () => void
  checkSession: () => Promise<boolean>
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      isAuthenticated: false,
      user: null,
      token: null,
      sessionExpires: null,
      loading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        set({ loading: true, error: null })
        try {
          const authService = AuthService.getInstance()
          const result = await authService.login(credentials)

          set({
            isAuthenticated: true,
            user: result.user,
            token: result.token,
            sessionExpires: result.expiresAt,
            loading: false,
          })
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : '登录失败',
          })
          throw error
        }
      },

      logout: async () => {
        try {
          const authService = AuthService.getInstance()
          await authService.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            sessionExpires: null,
            error: null,
          })
        }
      },

      refreshSession: async () => {
        const { token } = get()
        if (!token) return

        try {
          const authService = AuthService.getInstance()
          const newToken = await authService.refreshToken(token)
          const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8小时后过期

          set({
            token: newToken,
            sessionExpires: expiresAt,
          })
        } catch (error) {
          console.error('Failed to refresh session:', error)
          get().logout()
          throw error
        }
      },

      checkSession: async () => {
        const { token } = get()
        if (!token) return false

        try {
          const authService = AuthService.getInstance()
          const isValid = await authService.validateSession(token)

          if (!isValid) {
            get().logout()
            return false
          }

          return true
        } catch (error) {
          console.error('Session check failed:', error)
          get().logout()
          return false
        }
      },

      setUser: (user: User) => {
        set({ user })
      },

      setToken: (token: string, expiresAt: Date) => {
        set({ token, sessionExpires: expiresAt })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: state => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        sessionExpires: state.sessionExpires,
      }),
    }
  )
)
