// React 错误边界组件
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { crashReporter } from '../services/crashReporter'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React Error Boundary 捕获到错误:', error, errorInfo)

    // 发送崩溃报告
    crashReporter.reportError(error, {
      componentStack: errorInfo.componentStack,
    })

    // 触发自定义事件
    window.dispatchEvent(
      new CustomEvent('react-error', {
        detail: { error, errorInfo },
      })
    )
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <h1>应用遇到了一个错误</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            我们已经记录了这个错误，将尽快修复。
          </p>
          {this.state.error && (
            <details style={{ marginBottom: '20px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                错误详情
              </summary>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxWidth: '600px',
                }}
              >
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            重新加载
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
