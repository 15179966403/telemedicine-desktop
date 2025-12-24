/**
 * 加载状态和进度指示组件
 * Loading state and progress indicator components
 */

import React from 'react'
import './LoadingIndicator.css'

// 基础加载指示器
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  text?: string
  fullscreen?: boolean
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  text,
  fullscreen = false,
  className = '',
}) => {
  const content = (
    <div className={`loading-spinner loading-spinner-${size} ${className}`}>
      <div className="loading-spinner-circle"></div>
      {text && <p className="loading-spinner-text">{text}</p>}
    </div>
  )

  if (fullscreen) {
    return <div className="loading-fullscreen">{content}</div>
  }

  return content
}

// 进度条组件
interface ProgressBarProps {
  percentage: number
  showPercentage?: boolean
  status?: 'normal' | 'success' | 'error'
  text?: string
  className?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  showPercentage = true,
  status = 'normal',
  text,
  className = '',
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#52c41a'
      case 'error':
        return '#f5222d'
      default:
        return '#1890ff'
    }
  }

  return (
    <div className={`progress-bar ${className}`}>
      {text && <div className="progress-bar-text">{text}</div>}
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${clampedPercentage}%`,
            backgroundColor: getStatusColor(),
          }}
        >
          {showPercentage && (
            <span className="progress-bar-percentage">
              {Math.round(clampedPercentage)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// 圆形进度指示器
interface CircularProgressProps {
  percentage: number
  size?: number
  strokeWidth?: number
  showPercentage?: boolean
  status?: 'normal' | 'success' | 'error'
  className?: string
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 120,
  strokeWidth = 8,
  showPercentage = true,
  status = 'normal',
  className = '',
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedPercentage / 100) * circumference

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#52c41a'
      case 'error':
        return '#f5222d'
      default:
        return '#1890ff'
    }
  }

  return (
    <div
      className={`circular-progress ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        {/* 背景圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
        />
        {/* 进度圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStatusColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      {showPercentage && (
        <div className="circular-progress-text">
          {Math.round(clampedPercentage)}%
        </div>
      )}
    </div>
  )
}

// 骨架屏加载
interface SkeletonProps {
  rows?: number
  avatar?: boolean
  active?: boolean
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({
  rows = 3,
  avatar = false,
  active = true,
  className = '',
}) => {
  return (
    <div className={`skeleton ${active ? 'skeleton-active' : ''} ${className}`}>
      {avatar && <div className="skeleton-avatar"></div>}
      <div className="skeleton-content">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="skeleton-row"
            style={{
              width: index === rows - 1 ? '60%' : '100%',
            }}
          ></div>
        ))}
      </div>
    </div>
  )
}

// 加载状态包装器
interface LoadingWrapperProps {
  loading: boolean
  children: React.ReactNode
  skeleton?: boolean
  skeletonRows?: number
  text?: string
  className?: string
}

export const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  loading,
  children,
  skeleton = false,
  skeletonRows = 3,
  text,
  className = '',
}) => {
  if (!loading) {
    return <>{children}</>
  }

  if (skeleton) {
    return <Skeleton rows={skeletonRows} className={className} />
  }

  return (
    <div className={`loading-wrapper ${className}`}>
      <LoadingSpinner text={text} />
    </div>
  )
}
