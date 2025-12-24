/**
 * ConfirmDialog 组件测试
 * ConfirmDialog component tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConfirmDialog } from '@/components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('should not render when open is false', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Confirm"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm Action"
        message="Are you sure you want to proceed?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(
      screen.getByText('Are you sure you want to proceed?')
    ).toBeInTheDocument()
  })

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    const confirmButton = screen.getByText('确认')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('should call onCancel when cancel button is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    const cancelButton = screen.getByText('取消')
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('should call onCancel when overlay is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    const overlay = container.querySelector('.confirm-dialog-overlay')
    fireEvent.click(overlay!)

    expect(onCancel).toHaveBeenCalled()
  })

  it('should not call onCancel when dialog content is clicked', () => {
    const onCancel = vi.fn()

    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    const dialog = container.querySelector('.confirm-dialog')
    fireEvent.click(dialog!)

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('should render custom button text', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        confirmText="Yes, proceed"
        cancelText="No, cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Yes, proceed')).toBeInTheDocument()
    expect(screen.getByText('No, cancel')).toBeInTheDocument()
  })

  it('should display correct icon for different types', () => {
    const { rerender } = render(
      <ConfirmDialog
        open={true}
        title="Info"
        message="Message"
        type="info"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('ℹ️')).toBeInTheDocument()

    rerender(
      <ConfirmDialog
        open={true}
        title="Warning"
        message="Message"
        type="warning"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('⚠️')).toBeInTheDocument()

    rerender(
      <ConfirmDialog
        open={true}
        title="Danger"
        message="Message"
        type="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('🚨')).toBeInTheDocument()
  })

  it('should disable buttons when loading', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        loading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByText('处理中...')
    const cancelButton = screen.getByText('取消')

    expect(confirmButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it('should handle async onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByText('确认')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
  })

  it('should show processing state during async operation', async () => {
    const onConfirm = vi
      .fn()
      .mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByText('确认')
    fireEvent.click(confirmButton)

    // Should show processing state
    await waitFor(() => {
      expect(screen.getByText('处理中...')).toBeInTheDocument()
    })

    // Wait for completion
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })
  })
})
