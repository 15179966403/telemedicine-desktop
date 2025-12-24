/**
 * LoadingIndicator 组件测试
 * LoadingIndicator component tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  LoadingSpinner,
  ProgressBar,
  CircularProgress,
  Skeleton,
  LoadingWrapper,
} from '@/components/LoadingIndicator'

describe('LoadingSpinner', () => {
  it('should render spinner', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('should render with text', () => {
    render(<LoadingSpinner text="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { container: small } = render(<LoadingSpinner size="small" />)
    expect(small.querySelector('.loading-spinner-small')).toBeInTheDocument()

    const { container: medium } = render(<LoadingSpinner size="medium" />)
    expect(medium.querySelector('.loading-spinner-medium')).toBeInTheDocument()

    const { container: large } = render(<LoadingSpinner size="large" />)
    expect(large.querySelector('.loading-spinner-large')).toBeInTheDocument()
  })

  it('should render fullscreen when specified', () => {
    const { container } = render(<LoadingSpinner fullscreen={true} />)
    expect(container.querySelector('.loading-fullscreen')).toBeInTheDocument()
  })
})

describe('ProgressBar', () => {
  it('should render progress bar', () => {
    const { container } = render(<ProgressBar percentage={50} />)
    expect(container.querySelector('.progress-bar')).toBeInTheDocument()
  })

  it('should display correct percentage', () => {
    render(<ProgressBar percentage={75} showPercentage={true} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('should clamp percentage between 0 and 100', () => {
    const { rerender } = render(
      <ProgressBar percentage={150} showPercentage={true} />
    )
    expect(screen.getByText('100%')).toBeInTheDocument()

    rerender(<ProgressBar percentage={-50} showPercentage={true} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('should render with text', () => {
    render(<ProgressBar percentage={50} text="Uploading..." />)
    expect(screen.getByText('Uploading...')).toBeInTheDocument()
  })

  it('should apply correct status color', () => {
    const { container: normal } = render(
      <ProgressBar percentage={50} status="normal" />
    )
    const normalFill = normal.querySelector('.progress-bar-fill')
    expect(normalFill).toHaveStyle({ backgroundColor: '#1890ff' })

    const { container: success } = render(
      <ProgressBar percentage={100} status="success" />
    )
    const successFill = success.querySelector('.progress-bar-fill')
    expect(successFill).toHaveStyle({ backgroundColor: '#52c41a' })

    const { container: error } = render(
      <ProgressBar percentage={50} status="error" />
    )
    const errorFill = error.querySelector('.progress-bar-fill')
    expect(errorFill).toHaveStyle({ backgroundColor: '#f5222d' })
  })
})

describe('CircularProgress', () => {
  it('should render circular progress', () => {
    const { container } = render(<CircularProgress percentage={50} />)
    expect(container.querySelector('.circular-progress')).toBeInTheDocument()
  })

  it('should display percentage text', () => {
    render(<CircularProgress percentage={75} showPercentage={true} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('should hide percentage text when specified', () => {
    render(<CircularProgress percentage={75} showPercentage={false} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('should render with custom size', () => {
    const { container } = render(
      <CircularProgress percentage={50} size={150} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '150')
    expect(svg).toHaveAttribute('height', '150')
  })
})

describe('Skeleton', () => {
  it('should render skeleton', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
  })

  it('should render correct number of rows', () => {
    const { container } = render(<Skeleton rows={5} />)
    const rows = container.querySelectorAll('.skeleton-row')
    expect(rows).toHaveLength(5)
  })

  it('should render with avatar', () => {
    const { container } = render(<Skeleton avatar={true} />)
    expect(container.querySelector('.skeleton-avatar')).toBeInTheDocument()
  })

  it('should apply active animation', () => {
    const { container } = render(<Skeleton active={true} />)
    expect(container.querySelector('.skeleton-active')).toBeInTheDocument()
  })

  it('should not apply active animation when disabled', () => {
    const { container } = render(<Skeleton active={false} />)
    expect(container.querySelector('.skeleton-active')).not.toBeInTheDocument()
  })
})

describe('LoadingWrapper', () => {
  it('should render children when not loading', () => {
    render(
      <LoadingWrapper loading={false}>
        <div>Content</div>
      </LoadingWrapper>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should render loading spinner when loading', () => {
    const { container } = render(
      <LoadingWrapper loading={true}>
        <div>Content</div>
      </LoadingWrapper>
    )
    expect(container.querySelector('.loading-spinner')).toBeInTheDocument()
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('should render skeleton when loading with skeleton option', () => {
    const { container } = render(
      <LoadingWrapper loading={true} skeleton={true}>
        <div>Content</div>
      </LoadingWrapper>
    )
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('should render loading text', () => {
    render(
      <LoadingWrapper loading={true} text="Please wait...">
        <div>Content</div>
      </LoadingWrapper>
    )
    expect(screen.getByText('Please wait...')).toBeInTheDocument()
  })
})
