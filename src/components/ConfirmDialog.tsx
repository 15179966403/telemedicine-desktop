/**
 * 操作确认对话框组件
 * Confirmation dialog component
 */

import React, { useState } from 'react'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'info' | 'warning' | 'danger'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'info',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      await onConfirm()
    } finally {
      setIsProcessing(false)
    }
  }

  const getTypeIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️'
      case 'danger':
        return '🚨'
      default:
        return 'ℹ️'
    }
  }

  const getTypeColor = () => {
    switch (type) {
      case 'warning':
        return '#faad14'
      case 'danger':
        return '#f5222d'
      default:
        return '#1890ff'
    }
  }

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        onClick={e => e.stopPropagation()}
        style={{ borderTopColor: getTypeColor() }}
      >
        <div className="confirm-dialog-header">
          <span className="confirm-dialog-icon">{getTypeIcon()}</span>
          <h3 className="confirm-dialog-title">{title}</h3>
        </div>

        <div className="confirm-dialog-content">
          <p className="confirm-dialog-message">{message}</p>
        </div>

        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-button confirm-dialog-cancel"
            onClick={onCancel}
            disabled={isProcessing || loading}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-dialog-button confirm-dialog-confirm confirm-dialog-${type}`}
            onClick={handleConfirm}
            disabled={isProcessing || loading}
          >
            {isProcessing || loading ? '处理中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for using confirm dialog
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    title: string
    message: string
    type: 'info' | 'warning' | 'danger'
    onConfirm: () => void | Promise<void>
  }>({
    open: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {},
  })

  const confirm = (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'danger' = 'info'
  ): Promise<boolean> => {
    return new Promise(resolve => {
      setDialogState({
        open: true,
        title,
        message,
        type,
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, open: false }))
          resolve(true)
        },
      })
    })
  }

  const handleCancel = () => {
    setDialogState(prev => ({ ...prev, open: false }))
  }

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      open={dialogState.open}
      title={dialogState.title}
      message={dialogState.message}
      type={dialogState.type}
      onConfirm={dialogState.onConfirm}
      onCancel={handleCancel}
    />
  )

  return {
    confirm,
    ConfirmDialog: ConfirmDialogComponent,
  }
}
