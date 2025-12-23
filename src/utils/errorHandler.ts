// 错误处理工具

import type { AppError } from '@/types'
import { ERROR_CODES } from './constants'

/**
 * 应用错误类
 */
export class ApplicationError extends Error {
  public readonly type: string
  public readonly code?: string
  public readonly retryable: boolean
  public retryCount: number

  constructor(
    type: string,
    message: string,
    code?: string,
    retryable: boolean = false
  ) {
    super(message)
    this.name = 'ApplicationError'
    this.type = type
    this.code = code
    this.retryable = retryable
    this.retryCount = 0
  }

  toAppError(): AppError {
    return {
      type: this.type as AppError['type'],
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      retryCount: this.retryCount,
    }
  }
}

/**
 * 网络错误类
 */
export class NetworkError extends ApplicationError {
  constructor(message: string, code?: string) {
    super(ERROR_CODES.NETWORK_ERROR, message, code, true)
    this.name = 'NetworkError'
  }
}

/**
 * 认证错误类
 */
export class AuthError extends ApplicationError {
  constructor(message: string, code?: string) {
    super(ERROR_CODES.AUTH_ERROR, message, code, false)
    this.name = 'AuthError'
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends ApplicationError {
  public readonly field?: string

  constructor(message: string, field?: string, code?: string) {
    super(ERROR_CODES.VALIDATION_ERROR, message, code, false)
    this.name = 'ValidationError'
    this.field = field
  }
}

/**
 * 文件错误类
 */
export class FileError extends ApplicationError {
  constructor(message: string, code?: string) {
    super(ERROR_CODES.FILE_ERROR, message, code, false)
    this.name = 'FileError'
  }
}

/**
 * 权限错误类
 */
export class PermissionError extends ApplicationError {
  constructor(message: string, code?: string) {
    super(ERROR_CODES.PERMISSION_ERROR, message, code, false)
    this.name = 'PermissionError'
  }
}

/**
 * 全局错误处理器
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorListeners: ((error: AppError) => void)[] = []

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * 处理错误
   */
  handle(error: Error | AppError | ApplicationError): AppError {
    let appError: AppError

    if (error instanceof ApplicationError) {
      appError = error.toAppError()
    } else if (this.isAppError(error)) {
      appError = error
    } else {
      appError = this.convertToAppError(error)
    }

    // 记录错误
    this.logError(appError)

    // 通知监听器
    this.notifyListeners(appError)

    return appError
  }

  /**
   * 添加错误监听器
   */
  addErrorListener(listener: (error: AppError) => void): void {
    this.errorListeners.push(listener)
  }

  /**
   * 移除错误监听器
   */
  removeErrorListener(listener: (error: AppError) => void): void {
    const index = this.errorListeners.indexOf(listener)
    if (index > -1) {
      this.errorListeners.splice(index, 1)
    }
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(error: Error): NetworkError {
    let message = '网络连接异常'
    let code = 'NETWORK_UNKNOWN'

    if (error.message.includes('fetch')) {
      message = '网络请求失败，请检查网络连接'
      code = 'FETCH_ERROR'
    } else if (error.message.includes('timeout')) {
      message = '网络请求超时，请稍后重试'
      code = 'TIMEOUT_ERROR'
    } else if (error.message.includes('abort')) {
      message = '网络请求被取消'
      code = 'ABORT_ERROR'
    }

    return new NetworkError(message, code)
  }

  /**
   * 处理认证错误
   */
  handleAuthError(error: Error): AuthError {
    let message = '认证失败'
    let code = 'AUTH_UNKNOWN'

    if (error.message.includes('401')) {
      message = '用户未登录或登录已过期'
      code = 'UNAUTHORIZED'
    } else if (error.message.includes('403')) {
      message = '没有权限访问该资源'
      code = 'FORBIDDEN'
    } else if (error.message.includes('token')) {
      message = '登录凭证无效，请重新登录'
      code = 'INVALID_TOKEN'
    }

    return new AuthError(message, code)
  }

  /**
   * 重试错误
   */
  async retryError(
    appError: AppError,
    retryFn: () => Promise<any>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<any> {
    if (!appError.retryable || (appError.retryCount || 0) >= maxRetries) {
      throw appError
    }

    // 增加重试次数
    if (appError.retryCount !== undefined) {
      appError.retryCount++
    }

    // 等待延迟
    await new Promise(resolve =>
      setTimeout(resolve, delay * Math.pow(2, appError.retryCount || 0))
    )

    try {
      return await retryFn()
    } catch (error) {
      if (error instanceof Error) {
        const newError = this.handle(error)
        return this.retryError(newError, retryFn, maxRetries, delay)
      }
      throw error
    }
  }

  private isAppError(error: any): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error
    )
  }

  private convertToAppError(error: Error): AppError {
    // 根据错误类型和消息判断错误类别
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError(error.message).toAppError()
    }

    if (
      error.message.includes('401') ||
      error.message.includes('unauthorized')
    ) {
      return new AuthError(error.message).toAppError()
    }

    if (
      error.message.includes('validation') ||
      error.message.includes('invalid')
    ) {
      return new ValidationError(error.message).toAppError()
    }

    // 默认为未知错误
    return {
      type: ERROR_CODES.UNKNOWN_ERROR,
      message: error.message || '未知错误',
      retryable: false,
      retryCount: 0,
    }
  }

  private logError(error: AppError): void {
    const errorInfo = {
      type: error.type,
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    // 开发环境下在控制台输出
    if (import.meta.env.DEV) {
      console.error('Application Error:', errorInfo)
    }

    // 生产环境下可以发送到错误监控服务
    if (import.meta.env.PROD) {
      // TODO: 发送错误到监控服务
      // this.sendErrorToMonitoring(errorInfo)
    }
  }

  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error)
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError)
      }
    })
  }

  // Remove unused method
  // private async sendErrorToMonitoring(errorInfo: any): Promise<void> {
  //   try {
  //     // TODO: 实现错误监控服务集成
  //     // await fetch('/api/errors', {
  //     //   method: 'POST',
  //     //   headers: { 'Content-Type': 'application/json' },
  //     //   body: JSON.stringify(errorInfo)
  //     // })
  //   } catch (error) {
  //     console.error('Failed to send error to monitoring:', error)
  //   }
  // }
}

/**
 * 错误边界 Hook
 */
export function useErrorHandler() {
  const errorHandler = ErrorHandler.getInstance()

  const handleError = (
    error: Error | AppError | ApplicationError
  ): AppError => {
    return errorHandler.handle(error)
  }

  const handleAsyncError = async (
    asyncFn: () => Promise<any>,
    fallback?: any
  ): Promise<any> => {
    try {
      return await asyncFn()
    } catch (error) {
      const appError = handleError(error as Error)

      if (fallback !== undefined) {
        return fallback
      }

      throw appError
    }
  }

  const retryWithError = async (
    appError: AppError,
    retryFn: () => Promise<any>,
    maxRetries?: number,
    delay?: number
  ): Promise<any> => {
    return errorHandler.retryError(appError, retryFn, maxRetries, delay)
  }

  return {
    handleError,
    handleAsyncError,
    retryWithError,
    addErrorListener: errorHandler.addErrorListener.bind(errorHandler),
    removeErrorListener: errorHandler.removeErrorListener.bind(errorHandler),
  }
}

// 全局错误处理器实例
export const globalErrorHandler = ErrorHandler.getInstance()

// 全局未捕获错误处理
window.addEventListener('error', event => {
  globalErrorHandler.handle(event.error || new Error(event.message))
})

window.addEventListener('unhandledrejection', event => {
  globalErrorHandler.handle(
    event.reason || new Error('Unhandled promise rejection')
  )
})
