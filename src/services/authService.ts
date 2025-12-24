import { invoke } from '@tauri-apps/api/core'
import type { LoginCredentials, AuthResult, User } from '@/types'

export class AuthService {
  private static instance: AuthService

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      console.log('AuthService.login called with:', credentials)

      // Mock credentials for testing (dev mode only)
      if (import.meta.env.DEV) {
        const isMockLogin = this.checkMockCredentials(credentials)
        if (isMockLogin) {
          console.log('Using mock credentials for testing')
          return this.getMockAuthResult(credentials)
        }
      }

      // 调用 Tauri 命令进行认证
      const result = await invoke<{
        token: string
        user: {
          id: string
          username: string
          name: string
          role: string
          avatar?: string
          department?: string
          title?: string
        }
        expires_at: string
      }>('auth_login', { credentials })

      // 转换数据格式
      const authResult: AuthResult = {
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          phone: '', // TODO: 从后端获取
          department: result.user.department || '',
          title: result.user.title || '',
          licenseNumber: '', // TODO: 从后端获取
          auditStatus: 'approved', // TODO: 从后端获取
          createdAt: new Date(),
          lastLogin: new Date(),
        },
        expiresAt: new Date(result.expires_at),
      }

      return authResult
    } catch (error) {
      console.error('Login failed:', error)
      throw new Error(
        typeof error === 'string'
          ? error
          : '登录失败，请检查网络连接或联系管理员'
      )
    }
  }

  private checkMockCredentials(credentials: LoginCredentials): boolean {
    // Password login
    if (credentials.type === 'password') {
      return (
        credentials.username === 'test' && credentials.password === 'test123'
      )
    }
    // SMS login
    if (credentials.type === 'sms') {
      return (
        credentials.phone === '13800138000' && credentials.smsCode === '123456'
      )
    }
    // Real name login
    if (credentials.type === 'realname') {
      return credentials.idCard === '110101199001011234'
    }
    return false
  }

  private getMockAuthResult(credentials: LoginCredentials): AuthResult {
    const mockUser: User = {
      id: 'mock-user-1',
      username: credentials.username || 'test',
      name: '测试医生',
      phone: credentials.phone || '13800138000',
      department: '内科',
      title: '主治医师',
      licenseNumber: 'DOC123456',
      auditStatus: 'approved',
      createdAt: new Date(),
      lastLogin: new Date(),
    }

    return {
      token: 'mock-token-' + Date.now(),
      user: mockUser,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('AuthService.logout called')

      // 调用 Tauri 命令进行登出
      await invoke('auth_logout')
    } catch (error) {
      console.error('Logout failed:', error)
      // 即使登出失败，也要清除本地状态
    }
  }

  async refreshToken(currentToken: string): Promise<string> {
    try {
      console.log('AuthService.refreshToken called')

      // 调用 Tauri 命令刷新 token
      const newToken = await invoke<string>('auth_refresh_token', {
        currentToken,
      })

      return newToken
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw new Error('会话已过期，请重新登录')
    }
  }

  async validateSession(token: string): Promise<boolean> {
    try {
      console.log('AuthService.validateSession called')

      // Mock token validation for testing (dev mode only)
      if (import.meta.env.DEV && token.startsWith('mock-token-')) {
        return true
      }

      // 调用 Tauri 命令验证会话
      const isValid = await invoke<boolean>('auth_validate_session', {
        token,
      })

      return isValid
    } catch (error) {
      console.error('Session validation failed:', error)
      return false
    }
  }

  async getCurrentUser(token: string): Promise<User> {
    try {
      console.log('AuthService.getCurrentUser called')

      // TODO: 实现获取当前用户信息的 Tauri 命令
      // 暂时返回模拟数据
      await new Promise(resolve => setTimeout(resolve, 300))

      return {
        id: '1',
        username: 'doctor',
        name: '张医生',
        phone: '13800138000',
        department: '内科',
        title: '主治医师',
        licenseNumber: 'DOC123456',
        auditStatus: 'approved',
        createdAt: new Date(),
        lastLogin: new Date(),
      }
    } catch (error) {
      console.error('Get current user failed:', error)
      throw new Error('获取用户信息失败')
    }
  }
}
