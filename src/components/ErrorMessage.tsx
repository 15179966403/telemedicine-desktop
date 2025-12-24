/**
 * 用户友好的错误提示组件
 * User-friendly error message component
 */

import React from 'react'
import type { AppError } from '@/types'
import './ErrorMessage.css'

interface ErrorMessageProps {
  error: AppError | string | null
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
  className?: string
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}) => {
  if (!error) return null

  const errorObj: AppError =
    typeof error === 'string'
      ? {
          type: 'UNKNOWN_ERROR',
          message: error,
          timestamp: new Date(),
        }
      : error

  // 根据错误类型获取友好的标题和图标
  const getErrorDisplay = (type: AppError['type']) => {
    switch (type) {
      case 'NETWORK_ERROR':
        return {
          title: '网络连接异常',
          icon: '🌐',
          color: '#faad14',
        }
      case 'AUTH_ERROR':
        return {
          title: '认证失败',
          icon: '🔒',
          color: '#f5222d',
        }
      case 'VALIDATION_ERROR':
        return {
          title: '数据验证失败',
          icon: '⚠️',
          color: '#fa8c16',
        }
      case 'PERMISSION_ERROR':
        return {
          title: '权限不足',
          icon: '🚫',
          color: '#f5222d',
        }
      case 'DATA_ERROR':
        return {
          title: '数据错误',
          icon: '📊',
          color: '#fa8c16',
        }
      case 'SYSTEM_ERROR':
        return {
          title: '系统错误',
          icon: '⚙️',
          color: '#f5222d',
        }
      default:
        return {
          title: '操作失败',
          icon: '❌',
          color: '#f5222d',
        }
    }
  }

  const display = getErrorDisplay(errorObj.type)

  return (
    <div
      className={`error-message ${className}`}
      style={{ borderColor: display.color }}
    >
      <div className="error-message-header">
        <span className="error-message-icon">{display.icon}</span>
        <span className="error-message-title">{display.title}</span>
        {onDismiss && (
          <button
            className="error-message-close"
            onClick={onDismiss}
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>

      <div className="error-message-content">
        <p className="error-message-text">{errorObj.message}</p>

        {showDetails && errorObj.code && (
          <p className="error-message-code">错误代码: {errorObj.code}</p>
        )}

        {showDetails && errorObj.details && (
          <details className="error-message-details">
            <summary>详细信息</summary>
            <pre>{JSON.stringify(errorObj.details, null, 2)}</pre>
          </details>
        )}
      </div>

      {(onRetry || errorObj.retryable) && (
        <div className="error-message-actions">
          {onRetry && (
            <button className="error-message-retry" onClick={onRetry}>
              重试
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// 内联错误提示（用于表单字段等）
interface InlineErrorProps {
  message: string
  className?: string
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  className = '',
}) => {
  if (!message) return null

  return (
    <div className={`inline-error ${className}`}>
      <span className="inline-error-icon">⚠️</span>
      <span className="inline-error-text">{message}</span>
    </div>
  )
}
