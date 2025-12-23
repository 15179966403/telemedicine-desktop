import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  logout: () => void
  refreshSession: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string, expiresAt: Date) => void
  clearError: () => void
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
          // TODO: 实现实际的登录逻辑
          console.log('Login with credentials:', credentials)
          // 模拟登录成功
          const mockUser: User = {
            id: '1',
            username: credentials.username || 'doctor',
            name: '张医生',
            role: 'doctor',
            department: '内科',
            title: '主治医师',
          }
          const mockToken = 'mock-jwt-token'
          const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8小时后过期

          set({
            isAuthenticated: true,
            user: mockUser,
            token: mockToken,
            sessionExpires: expiresAt,
            loading: false,
          })
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : '登录失败',
          })
        }
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          sessionExpires: null,
          error: null,
        })
      },

      refreshSession: async () => {
        const { token } = get()
        if (!token) return

        try {
          // TODO: 实现 token 刷新逻辑
          console.log('Refreshing session...')
        } catch (error) {
          console.error('Failed to refresh session:', error)
          get().logout()
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
