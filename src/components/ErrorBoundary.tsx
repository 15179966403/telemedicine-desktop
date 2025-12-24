/**
 * React 错误边界组件
 * Error Boundary Component for catching React errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { globalErrorHandler } from '@/utils/errorHandler'
import type { AppError } from '@/types'

interface Props {
  children: ReactNode
  fallback?: (error: AppError, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: AppError | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    const appError = globalErrorHandler.handle(error)
    return {
      hasError: true,
      error: appError,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    console.error('Error caught by boundary:', error, errorInfo)

    // 调用自定义错误处理
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 全局错误处理
    globalErrorHandler.handle(error)
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError)
      }

      // 默认错误 UI
      return (
        <div
          style={{
            padding: '20px',
            margin: '20px',
            border: '1px solid #f5222d',
            borderRadius: '4px',
            backgroundColor: '#fff2f0',
          }}
        >
          <h2 style={{ color: '#f5222d', marginBottom: '10px' }}>
            应用出现错误
          </h2>
          <p style={{ marginBottom: '10px' }}>
            {this.state.error.message || '未知错误'}
          </p>
          {this.state.error.code && (
            <p
              style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}
            >
              错误代码: {this.state.error.code}
            </p>
          )}
          <button
            onClick={this.resetError}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
