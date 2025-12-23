import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '@/services/authService'
import type { LoginCredentials } from '@/types'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('Authentication Integration Tests', () => {
  let authService: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    authService = AuthService.getInstance()
  })

  describe('Login Flow', () => {
    it('should handle successful password login', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      const mockResponse = {
        token: 'mock-jwt-token',
        user: {
          id: '1',
          username: 'doctor',
          name: '张医生',
          role: 'doctor',
          department: '内科',
          title: '主治医师',
        },
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      }

      mockInvoke.mockResolvedValueOnce(mockResponse)

      const credentials: LoginCredentials = {
        type: 'password',
        username: 'doctor',
        password: '123456',
      }

      const result = await authService.login(credentials)

      expect(mockInvoke).toHaveBeenCalledWith('auth_login', { credentials })
      expect(result.token).toBe('mock-jwt-token')
      expect(result.user?.username).toBe('doctor')
      expect(result.user?.name).toBe('张医生')
    })

    it('should handle login failure', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      mockInvoke.mockRejectedValueOnce('用户名或密码错误')

      const credentials: LoginCredentials = {
        type: 'password',
        username: 'doctor',
        password: 'wrong-password',
      }

      await expect(authService.login(credentials)).rejects.toThrow(
        '用户名或密码错误'
      )
    })

    it('should handle SMS login', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      const mockResponse = {
        token: 'sms-jwt-token',
        user: {
          id: '2',
          username: 'user_8000',
          name: '李医生',
          role: 'doctor',
          department: '外科',
          title: '副主任医师',
        },
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      }

      mockInvoke.mockResolvedValueOnce(mockResponse)

      const credentials: LoginCredentials = {
        type: 'sms',
        phone: '13800138000',
        smsCode: '123456',
      }

      const result = await authService.login(credentials)

      expect(mockInvoke).toHaveBeenCalledWith('auth_login', { credentials })
      expect(result.token).toBe('sms-jwt-token')
      expect(result.user?.name).toBe('李医生')
    })
  })

  describe('Session Management', () => {
    it('should validate valid session', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      mockInvoke.mockResolvedValueOnce(true)

      const isValid = await authService.validateSession('valid-token')

      expect(mockInvoke).toHaveBeenCalledWith('auth_validate_session', {
        token: 'valid-token',
      })
      expect(isValid).toBe(true)
    })

    it('should refresh token successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      mockInvoke.mockResolvedValueOnce('new-jwt-token')

      const newToken = await authService.refreshToken('current-token')

      expect(mockInvoke).toHaveBeenCalledWith('auth_refresh_token', {
        currentToken: 'current-token',
      })
      expect(newToken).toBe('new-jwt-token')
    })
  })

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      mockInvoke.mockResolvedValueOnce(undefined)

      await authService.logout()

      expect(mockInvoke).toHaveBeenCalledWith('auth_logout')
    })
  })
})
