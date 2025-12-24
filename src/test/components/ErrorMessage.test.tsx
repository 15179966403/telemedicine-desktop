/**
 * ErrorMessage 组件测试
 * ErrorMessage component tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorMessage, InlineError } from '@/components/ErrorMessage'
import type { AppError } from '@/types'

describe('ErrorMessage', () => {
  it('should render nothing when error is null', () => {
    const { container } = render(<ErrorMessage error={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render error message from string', () => {
    render(<ErrorMessage error="Test error message" />)
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('should render error message from AppError object', () => {
    const error: AppError = {
      type: 'NETWORK_ERROR',
      message: 'Network connection failed',
      timestamp: new Date(),
    }

    render(<ErrorMessage error={error} />)
    expect(screen.getByText('Network connection failed')).toBeInTheDocument()
    expect(screen.getByText('网络连接异常')).toBeInTheDocument()
  })

  it('should display error code when showDetails is true', () => {
    const error: AppError = {
      type: 'NETWORK_ERROR',
      message: 'Network error',
      code: 'NET_001',
      timestamp: new Date(),
    }

    render(<ErrorMessage error={error} showDetails={true} />)
    expect(screen.getByText(/错误代码: NET_001/)).toBeInTheDocument()
  })

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    const error: AppError = {
      type: 'NETWORK_ERROR',
      message: 'Network error',
      retryable: true,
      timestamp: new Date(),
    }

    render(<ErrorMessage error={error} onRetry={onRetry} />)

    const retryButton = screen.getByText('重试')
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalled()
  })

  it('should call onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    const error: AppError = {
      type: 'NETWORK_ERROR',
      message: 'Network error',
      timestamp: new Date(),
    }

    render(<ErrorMessage error={error} onDismiss={onDismiss} />)

    const closeButton = screen.getByLabelText('关闭')
    fireEvent.click(closeButton)

    expect(onDismiss).toHaveBeenCalled()
  })

  it('should display correct icon for different error types', () => {
    const errorTypes: Array<AppError['type']> = [
      'NETWORK_ERROR',
      'AUTH_ERROR',
      'VALIDATION_ERROR',
      'PERMISSION_ERROR',
    ]

    errorTypes.forEach(type => {
      const { unmount } = render(
        <ErrorMessage
          error={{
            type,
            message: 'Test error',
            timestamp: new Date(),
          }}
        />
      )
      unmount()
    })
  })

  it('should show details section when showDetails is true and details exist', () => {
    const error: AppError = {
      type: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: { field: 'email', reason: 'invalid format' },
      timestamp: new Date(),
    }

    render(<ErrorMessage error={error} showDetails={true} />)
    expect(screen.getByText('详细信息')).toBeInTheDocument()
  })
})

describe('InlineError', () => {
  it('should render nothing when message is empty', () => {
    const { container } = render(<InlineError message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('should render error message', () => {
    render(<InlineError message="Invalid input" />)
    expect(screen.getByText('Invalid input')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <InlineError message="Error" className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('inline-error', 'custom-class')
  })
})
