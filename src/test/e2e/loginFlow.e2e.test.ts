/**
 * 用户登录流程端到端测试
 * User Login Flow End-to-End Tests
 *
 * 需求覆盖: 1.1-1.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import { useAuthStore } from '@/stores/authStore'
import type { AuthResult } from '@/types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock router navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('用户登录流程端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset auth store
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null,
      sessionExpires: null,
    })
  })

  describe('需求 1.1 - 账号密码登录', () => {
    it('应该允许医生使用正确的账号密码登录并跳转到工作台', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const mockAuthResult: AuthResult = {
        token: 'valid-jwt-token',
        user: {
          id: 'doctor-001',
          username: 'doctor_zhang',
          name: '张医生',
          role: 'doctor',
          department: '内科',
          title: '主治医师',
          verified: true,
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockAuthResult)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      // 输入用户名
      const usernameInput = screen.getByPlaceholderText(/用户名|账号/i)
      await user.type(usernameInput, 'doctor_zhang')

      // 输入密码
      const passwordInput = screen.getByPlaceholderText(/密码/i)
      await user.type(passwordInput, 'password123')

      // 点击登录按钮
      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 验证调用了正确的 Tauri 命令
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('auth_login', {
          credentials: {
            type: 'password',
            username: 'doctor_zhang',
            password: 'password123',
          },
        })
      })

      // 验证登录成功后跳转到工作台
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace')
      })

      // 验证认证状态已更新
      const authState = useAuthStore.getState()
      expect(authState.isAuthenticated).toBe(true)
      expect(authState.user?.username).toBe('doctor_zhang')
      expect(authState.token).toBe('valid-jwt-token')
    })

    it('应该在密码错误时显示错误提示', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockRejectedValueOnce('用户名或密码错误')

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const usernameInput = screen.getByPlaceholderText(/用户名|账号/i)
      await user.type(usernameInput, 'doctor_zhang')

      const passwordInput = screen.getByPlaceholderText(/密码/i)
      await user.type(passwordInput, 'wrong_password')

      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 验证显示错误消息
      await waitFor(() => {
        expect(screen.getByText(/用户名或密码错误/i)).toBeInTheDocument()
      })

      // 验证未跳转
      expect(mockNavigate).not.toHaveBeenCalled()

      // 验证认证状态未改变
      const authState = useAuthStore.getState()
      expect(authState.isAuthenticated).toBe(false)
    })
  })

  describe('需求 1.2 - 短信验证码登录', () => {
    it('应该允许医生使用短信验证码登录', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const mockAuthResult: AuthResult = {
        token: 'sms-jwt-token',
        user: {
          id: 'doctor-002',
          username: 'doctor_li',
          name: '李医生',
          role: 'doctor',
          department: '外科',
          title: '副主任医师',
          verified: true,
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      }

      // Mock send SMS code
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })
      // Mock login with SMS
      vi.mocked(invoke).mockResolvedValueOnce(mockAuthResult)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      // 切换到短信登录
      const smsTabButton = screen.getByText(/短信登录|验证码登录/i)
      await user.click(smsTabButton)

      // 输入手机号
      const phoneInput = screen.getByPlaceholderText(/手机号/i)
      await user.type(phoneInput, '13800138000')

      // 点击发送验证码
      const sendCodeButton = screen.getByRole('button', { name: /发送验证码/i })
      await user.click(sendCodeButton)

      // 验证发送验证码请求
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('auth_send_sms_code', {
          phone: '13800138000',
        })
      })

      // 输入验证码
      const codeInput = screen.getByPlaceholderText(/验证码/i)
      await user.type(codeInput, '123456')

      // 点击登录
      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 验证登录请求
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('auth_login', {
          credentials: {
            type: 'sms',
            phone: '13800138000',
            smsCode: '123456',
          },
        })
      })

      // 验证登录成功
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace')
      })
    })

    it('应该在验证码错误时显示错误提示', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      // Mock send SMS success
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })
      // Mock login failure
      vi.mocked(invoke).mockRejectedValueOnce('验证码错误或已过期')

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const smsTabButton = screen.getByText(/短信登录|验证码登录/i)
      await user.click(smsTabButton)

      const phoneInput = screen.getByPlaceholderText(/手机号/i)
      await user.type(phoneInput, '13800138000')

      const sendCodeButton = screen.getByRole('button', { name: /发送验证码/i })
      await user.click(sendCodeButton)

      const codeInput = screen.getByPlaceholderText(/验证码/i)
      await user.type(codeInput, '000000')

      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText(/验证码错误或已过期/i)).toBeInTheDocument()
      })
    })
  })

  describe('需求 1.3 - 首次登录实名认证', () => {
    it('应该在首次登录时要求完成实名认证', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const mockAuthResult: AuthResult = {
        token: 'temp-token',
        user: {
          id: 'doctor-003',
          username: 'doctor_wang',
          name: '王医生',
          role: 'doctor',
          department: '儿科',
          title: '医师',
          verified: false, // 未实名认证
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        requiresVerification: true,
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockAuthResult)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const usernameInput = screen.getByPlaceholderText(/用户名|账号/i)
      await user.type(usernameInput, 'doctor_wang')

      const passwordInput = screen.getByPlaceholderText(/密码/i)
      await user.type(passwordInput, 'password123')

      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 验证跳转到实名认证页面
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/verification')
      })
    })
  })

  describe('需求 1.4 - 登录凭证过期处理', () => {
    it('应该在凭证过期时自动跳转到登录页面', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      // 设置已过期的认证状态
      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'doctor-001',
          username: 'doctor_zhang',
          name: '张医生',
          role: 'doctor',
          department: '内科',
          title: '主治医师',
          verified: true,
        },
        token: 'expired-token',
        sessionExpires: new Date(Date.now() - 1000), // 已过期
      })

      // Mock session validation failure
      vi.mocked(invoke).mockRejectedValueOnce('Session expired')

      // 触发会话验证
      const authStore = useAuthStore.getState()
      try {
        await authStore.validateSession?.()
      } catch (error) {
        // Expected to fail
      }

      // 验证认证状态被清除
      const currentState = useAuthStore.getState()
      expect(currentState.isAuthenticated).toBe(false)
      expect(currentState.token).toBeNull()
    })

    it('应该在token即将过期时自动刷新', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      // 设置即将过期的认证状态（5分钟后过期）
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'doctor-001',
          username: 'doctor_zhang',
          name: '张医生',
          role: 'doctor',
          department: '内科',
          title: '主治医师',
          verified: true,
        },
        token: 'current-token',
        sessionExpires: expiresAt,
      })

      // Mock token refresh
      vi.mocked(invoke).mockResolvedValueOnce({
        token: 'new-refreshed-token',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      })

      // 触发token刷新
      const authStore = useAuthStore.getState()
      await authStore.refreshToken?.()

      // 验证token已更新
      const currentState = useAuthStore.getState()
      expect(currentState.token).toBe('new-refreshed-token')
      expect(currentState.sessionExpires?.getTime()).toBeGreaterThan(
        expiresAt.getTime()
      )
    })
  })

  describe('需求 1.5 - 资质审核状态检查', () => {
    it('应该在资质未通过审核时显示审核状态并限制功能访问', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const mockAuthResult: AuthResult = {
        token: 'pending-token',
        user: {
          id: 'doctor-004',
          username: 'doctor_zhao',
          name: '赵医生',
          role: 'doctor',
          department: '皮肤科',
          title: '医师',
          verified: true,
          qualificationStatus: 'pending', // 审核中
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockAuthResult)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const usernameInput = screen.getByPlaceholderText(/用户名|账号/i)
      await user.type(usernameInput, 'doctor_zhao')

      const passwordInput = screen.getByPlaceholderText(/密码/i)
      await user.type(passwordInput, 'password123')

      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 验证显示审核状态提示
      await waitFor(() => {
        expect(
          screen.getByText(/资质审核中|审核状态/i)
        ).toBeInTheDocument()
      })
    })

    it('应该在资质审核失败时显示失败原因', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const mockAuthResult: AuthResult = {
        token: 'rejected-token',
        user: {
          id: 'doctor-005',
          username: 'doctor_qian',
          name: '钱医生',
          role: 'doctor',
          department: '骨科',
          title: '医师',
          verified: true,
          qualificationStatus: 'rejected', // 审核失败
          qualificationReason: '医师资格证书信息不完整',
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockAuthResult)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const usernameInput = screen.getByPlaceholderText(/用户名|账号/i)
      await user.type(usernameInput, 'doctor_qian')

      const passwordInput = screen.getByPlaceholderText(/密码/i)
      await user.type(passwordInput, 'password123')

      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 验证显示审核失败原因
      await waitFor(() => {
        expect(
          screen.getByText(/医师资格证书信息不完整/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('完整登录流程集成测试', () => {
    it('应该完成从登录到工作台的完整流程', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const mockAuthResult: AuthResult = {
        token: 'complete-flow-token',
        user: {
          id: 'doctor-006',
          username: 'doctor_sun',
          name: '孙医生',
          role: 'doctor',
          department: '心内科',
          title: '主任医师',
          verified: true,
          qualificationStatus: 'approved',
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockAuthResult)

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      // 步骤1: 输入凭证
      const usernameInput = screen.getByPlaceholderText(/用户名|账号/i)
      await user.type(usernameInput, 'doctor_sun')

      const passwordInput = screen.getByPlaceholderText(/密码/i)
      await user.type(passwordInput, 'password123')

      // 步骤2: 提交登录
      const loginButton = screen.getByRole('button', { name: /登录/i })
      await user.click(loginButton)

      // 步骤3: 验证登录成功
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('auth_login', expect.any(Object))
      })

      // 步骤4: 验证状态更新
      await waitFor(() => {
        const authState = useAuthStore.getState()
        expect(authState.isAuthenticated).toBe(true)
        expect(authState.user?.username).toBe('doctor_sun')
        expect(authState.token).toBe('complete-flow-token')
      })

      // 步骤5: 验证跳转到工作台
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace')
      })
    })
  })
})
