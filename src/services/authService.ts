import { invoke } from '@tauri-apps/api/core'
import type { LoginCredentials, AuthResult, User, CaptchaResult } from '@/types'
import { API_BASE_URL, STORAGE_KEYS } from '@/utils/constants'

export class AuthService {
  private static instance: AuthService

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * 获取图片验证码
   * 对应后台接口 GET /captchaImage
   */
  async getCaptchaImage(): Promise<CaptchaResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/captchaImage`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
        },
      })

      if (!res.ok) {
        throw new Error(`获取验证码失败: HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.code !== 200 && data.code !== undefined) {
        throw new Error(data.msg || '获取验证码失败')
      }

      return {
        code: data.code,
        msg: data.msg,
        img: data.img,
        uuid: data.uuid,
      }
    } catch (error) {
      console.error('getCaptchaImage error:', error)
      throw error instanceof Error
        ? error
        : new Error('获取验证码失败，请检查网络连接')
    }
  }

  /**
   * 用户登录方法
   * 账号密码登录对接后台真实接口 POST /admin/login
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      console.log('AuthService.login called with:', {
        type: credentials.type,
        username: credentials.username,
        hasPassword: Boolean(credentials.password),
        hasCode: Boolean(credentials.code),
        uuid: credentials.uuid,
      })

      // 密码登录：若提供真实验证码或非 Mock 账号，走真实后端接口
      if (credentials.type === 'password') {
        const isMock = this.checkMockCredentials(credentials)
        // 只有在明确输入测试账号且未填验证码时走本地Mock
        if (isMock && !credentials.code) {
          console.log('Using mock credentials for testing')
          return this.getMockAuthResult(credentials)
        }

        // 真实接口调用
        return await this.loginWithRealApi(credentials)
      }

      // 其他登录方式（短信/实名认证）在无后端支持前保留原有逻辑
      if (import.meta.env.DEV) {
        const isMockLogin = this.checkMockCredentials(credentials)
        if (isMockLogin) {
          return this.getMockAuthResult(credentials)
        }
      }

      // 调用 Tauri 命令进行认证（兜底本地认证）
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

      const authResult: AuthResult = {
        success: true,
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          phone: '',
          department: result.user.department || '',
          title: result.user.title || '',
          licenseNumber: '',
          auditStatus: 'approved',
          createdAt: new Date(),
          lastLogin: new Date(),
        },
        expiresAt: new Date(result.expires_at),
      }

      return authResult
    } catch (error) {
      console.error('Login failed:', error)
      throw error instanceof Error
        ? error
        : new Error('登录失败，请检查网络连接或联系管理员')
    }
  }

  /**
   * 使用真实接口进行登录认证
   */
  private async loginWithRealApi(
    credentials: LoginCredentials
  ): Promise<AuthResult> {
    const loginPayload = {
      username: credentials.username?.trim(),
      password: credentials.password,
      code: credentials.code?.trim(),
      uuid: credentials.uuid,
    }

    const response = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: JSON.stringify(loginPayload),
    })

    if (!response.ok) {
      throw new Error(`登录请求失败: HTTP ${response.status}`)
    }

    const resData = await response.json()
    if (resData.code !== 200) {
      throw new Error(resData.msg || '登录失败，请检查账号密码或验证码')
    }

    const token = resData.token
    if (!token) {
      throw new Error('登录成功但未返回有效令牌')
    }

    // 登录成功后，通过真实接口获取当前登录用户完整信息
    const currentUser = await this.getCurrentUser(token)

    // Token 有效期默认 8 小时
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

    // Token 及用户信息持久化
    this.persistSession(token, currentUser, expiresAt)

    return {
      success: true,
      token,
      user: currentUser,
      expiresAt,
    }
  }

  /**
   * 获取当前登录用户信息
   * 对应后台接口 GET /admin/getInfo
   */
  async getCurrentUser(token: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/getInfo`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`获取用户信息接口响应异常: HTTP ${response.status}`)
      }

      const res = await response.json()
      if (res.code !== 200) {
        throw new Error(res.msg || '获取用户信息失败')
      }

      const sysUser = res.user || {}
      const roles: string[] = res.roles || []
      const permissions: string[] = res.permissions || []

      // 保持原始字段格式，遵循项目约束：所有名为 id 或符合 xxxxId 形式的字段保持原始格式
      const rawId =
        sysUser.userId != null
          ? sysUser.userId
          : sysUser.id != null
            ? sysUser.id
            : 'user-0'
      const rawUserId = sysUser.userId
      const rawDeptId = sysUser.deptId
      const rawTenantId = sysUser.tenantId

      const user: User = {
        id: rawId,
        userId: rawUserId,
        tenantId: rawTenantId,
        deptId: rawDeptId,
        username: sysUser.userName || '',
        name: sysUser.trueName || sysUser.nickName || sysUser.userName || '用户',
        trueName: sysUser.trueName,
        phone: sysUser.phonenumber || '',
        phonenumber: sysUser.phonenumber,
        email: sysUser.email || '',
        avatar: sysUser.avatar || '',
        department: sysUser.dept?.deptName || '',
        title:
          sysUser.title || (roles.length > 0 ? roles.join(', ') : '系统用户'),
        roles,
        permissions,
        auditStatus: 'approved',
        createdAt: sysUser.createTime ? new Date(sysUser.createTime) : new Date(),
        lastLogin: new Date(),
      }

      return user
    } catch (error) {
      console.error('getCurrentUser error:', error)
      throw error instanceof Error
        ? error
        : new Error('获取当前登录用户信息失败')
    }
  }

  /**
   * 本地与原生存储 Token 持久化
   */
  private persistSession(token: string, user: User, expiresAt: Date): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token)
      localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user))
    }

    // 若运行在 Tauri 桌面原生环境中，同步持久化至原生 SQLite
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      invoke('auth_save_session', {
        token,
        user: {
          id: user.id,
          userId: user.userId,
          username: user.username,
          name: user.name,
          role: user.roles?.[0] || 'doctor',
          department: user.department,
          title: user.title,
        },
        expiresAt: expiresAt.toISOString(),
      }).catch(err => {
        console.warn('Native SQLite auth_save_session warning:', err)
      })
    }
  }

  private checkMockCredentials(credentials: LoginCredentials): boolean {
    if (credentials.type === 'password') {
      return (
        credentials.username === 'test' && credentials.password === 'test123'
      )
    }
    if (credentials.type === 'sms') {
      return (
        credentials.phone === '13800138000' && credentials.smsCode === '123456'
      )
    }
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

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)
    const token = 'mock-token-' + Date.now()

    this.persistSession(token, mockUser, expiresAt)

    return {
      success: true,
      token,
      user: mockUser,
      expiresAt,
    }
  }

  /**
   * 退出登录
   */
  async logout(): Promise<void> {
    try {
      console.log('AuthService.logout called')
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
          : null

      if (token && !token.startsWith('mock-token-')) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `Bearer ${token}`,
          },
        }).catch(err => {
          console.warn('Remote logout warning:', err)
        })
      }

      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        await invoke('auth_logout', { token })
      }
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER_INFO)
      }
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(currentToken: string): Promise<string> {
    try {
      console.log('AuthService.refreshToken called')
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const newToken = await invoke<string>('auth_refresh_token', {
          currentToken,
        })
        return newToken
      }
      return currentToken
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw new Error('会话已过期，请重新登录')
    }
  }

  /**
   * 校验会话有效性
   */
  async validateSession(token: string): Promise<boolean> {
    try {
      if (!token) return false

      if (token.startsWith('mock-token-')) {
        return true
      }

      // 请求 /admin/getInfo 校验 Token 是否仍然有效
      const response = await fetch(`${API_BASE_URL}/admin/getInfo`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const res = await response.json()
        return res.code === 200
      }

      return false
    } catch (error) {
      console.error('Session validation failed:', error)
      return false
    }
  }
}
