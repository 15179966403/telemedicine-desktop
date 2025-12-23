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
      // TODO: 实现实际的 API 调用
      console.log('AuthService.login called with:', credentials)

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 模拟返回数据
      const mockUser: User = {
        id: '1',
        username: credentials.username || 'doctor',
        name: '张医生',
        role: 'doctor',
        department: '内科',
        title: '主治医师',
      }

      return {
        token: 'mock-jwt-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8小时后过期
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw new Error('登录失败，请检查网络连接或联系管理员')
    }
  }

  async logout(): Promise<void> {
    try {
      // TODO: 调用登出 API
      console.log('AuthService.logout called')

      // 清除本地存储的认证信息
      // 这将由 store 处理
    } catch (error) {
      console.error('Logout failed:', error)
      // 即使登出失败，也要清除本地状态
    }
  }

  async refreshToken(_currentToken: string): Promise<string> {
    try {
      // TODO: 实现 token 刷新逻辑
      console.log('AuthService.refreshToken called')

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 500))

      return 'new-mock-jwt-token'
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw new Error('会话已过期，请重新登录')
    }
  }

  async validateSession(token: string): Promise<boolean> {
    try {
      // TODO: 实现会话验证逻辑
      console.log('AuthService.validateSession called')

      // 模拟验证
      return token === 'mock-jwt-token' || token === 'new-mock-jwt-token'
    } catch (error) {
      console.error('Session validation failed:', error)
      return false
    }
  }

  async getCurrentUser(_token: string): Promise<User> {
    try {
      // TODO: 实现获取当前用户信息的逻辑
      console.log('AuthService.getCurrentUser called')

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 300))

      return {
        id: '1',
        username: 'doctor',
        name: '张医生',
        role: 'doctor',
        department: '内科',
        title: '主治医师',
      }
    } catch (error) {
      console.error('Get current user failed:', error)
      throw new Error('获取用户信息失败')
    }
  }
}
