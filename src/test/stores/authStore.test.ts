import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'
import type { LoginCredentials, User } from '@/types'

// Create mock functions
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockRefreshToken = vi.fn()
const mockValidateSession = vi.fn()

// Mock AuthService
vi.mock('@/services', () => ({
  AuthService: {
    getInstance: vi.fn(() => ({
      login: mockLogin,
      logout: mockLogout,
      refreshToken: mockRefreshToken,
      validateSession: mockValidateSession,
    })),
  },
}))

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null,
      sessionExpires: null,
      loading: false,
      error: null,
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState()

      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.sessionExpires).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('Login', () => {
    const mockCredentials: LoginCredentials = {
      type: 'password',
      username: 'doctor@test.com',
      password: 'password123',
    }

    const mockUser: User = {
      id: '1',
      username: 'doctor@test.com',
      name: '张医生',
      phone: '13800138000',
      department: '内科',
      title: '主治医师',
      licenseNumber: 'DOC123456',
      auditStatus: 'approved',
      createdAt: new Date(),
    }

    const mockAuthResult = {
      success: true,
      token: 'mock-token',
      user: mockUser,
    }

    it('should login successfully', async () => {
      mockLogin.mockResolvedValue(mockAuthResult)

      const { login } = useAuthStore.getState()
      await login(mockCredentials)

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(mockUser)
      expect(state.token).toBe('mock-token')
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set loading state during login', async () => {
      mockLogin.mockImplementation(
        () =>
          new Promise(resolve => setTimeout(() => resolve(mockAuthResult), 100))
      )

      const { login } = useAuthStore.getState()
      const loginPromise = login(mockCredentials)

      // Check loading state
      expect(useAuthStore.getState().loading).toBe(true)

      await loginPromise

      // Check final state
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('should handle login failure', async () => {
      const errorMessage = '用户名或密码错误'
      mockLogin.mockRejectedValue(new Error(errorMessage))

      const { login } = useAuthStore.getState()

      await expect(login(mockCredentials)).rejects.toThrow(errorMessage)

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBe(errorMessage)
    })
  })

  describe('Logout', () => {
    beforeEach(() => {
      // Set authenticated state
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '1', name: '张医生' } as User,
        token: 'mock-token',
        sessionExpires: new Date(),
      })
    })

    it('should logout successfully', async () => {
      mockLogout.mockResolvedValue(undefined)

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.sessionExpires).toBeNull()
      expect(state.error).toBeNull()
    })

    it('should clear state even if logout service fails', async () => {
      mockLogout.mockRejectedValue(new Error('Network error'))

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
    })
  })

  describe('Session Management', () => {
    beforeEach(() => {
      useAuthStore.setState({
        token: 'mock-token',
      })
    })

    it('should refresh session successfully', async () => {
      const newToken = 'new-mock-token'
      mockRefreshToken.mockResolvedValue(newToken)

      const { refreshSession } = useAuthStore.getState()
      await refreshSession()

      const state = useAuthStore.getState()
      expect(state.token).toBe(newToken)
      expect(state.sessionExpires).toBeInstanceOf(Date)
    })

    it('should logout on refresh failure', async () => {
      mockRefreshToken.mockRejectedValue(new Error('Token expired'))

      const { refreshSession } = useAuthStore.getState()

      await expect(refreshSession()).rejects.toThrow('Token expired')

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
    })

    it('should validate session successfully', async () => {
      mockValidateSession.mockResolvedValue(true)

      const { checkSession } = useAuthStore.getState()
      const result = await checkSession()

      expect(result).toBe(true)
      expect(mockValidateSession).toHaveBeenCalledWith('mock-token')
    })

    it('should logout on invalid session', async () => {
      mockValidateSession.mockResolvedValue(false)

      const { checkSession } = useAuthStore.getState()
      const result = await checkSession()

      expect(result).toBe(false)
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
    })

    it('should return early when no token exists for refresh', async () => {
      useAuthStore.setState({ token: null })

      const { refreshSession } = useAuthStore.getState()
      const result = await refreshSession()

      expect(result).toBeUndefined()
      expect(mockRefreshToken).not.toHaveBeenCalled()
    })

    it('should return false when no token exists for validation', async () => {
      useAuthStore.setState({ token: null })

      const { checkSession } = useAuthStore.getState()
      const result = await checkSession()

      expect(result).toBe(false)
      expect(mockValidateSession).not.toHaveBeenCalled()
    })
  })

  describe('Utility Actions', () => {
    it('should set user', () => {
      const mockUser: User = {
        id: '1',
        name: '张医生',
      } as User

      const { setUser } = useAuthStore.getState()
      setUser(mockUser)

      expect(useAuthStore.getState().user).toEqual(mockUser)
    })

    it('should set token', () => {
      const token = 'new-token'
      const expiresAt = new Date()

      const { setToken } = useAuthStore.getState()
      setToken(token, expiresAt)

      const state = useAuthStore.getState()
      expect(state.token).toBe(token)
      expect(state.sessionExpires).toBe(expiresAt)
    })

    it('should clear error', () => {
      useAuthStore.setState({ error: 'Some error' })

      const { clearError } = useAuthStore.getState()
      clearError()

      expect(useAuthStore.getState().error).toBeNull()
    })
  })
})
