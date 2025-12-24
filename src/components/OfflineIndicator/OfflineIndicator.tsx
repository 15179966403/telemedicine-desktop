/**
 * 离线状态指示器组件
 * Offline status indicator component
 */

import React from 'react'
import { Badge, Tooltip, Space, Typography, Button } from 'antd'
import {
  WifiOutlined,
  DisconnectOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons'
import { useOfflineStore } from '@/stores/offlineStore'
import './OfflineIndicator.css'

const { Text } = Typography

export interface OfflineIndicatorProps {
  className?: string
  showDetails?: boolean
  size?: 'small' | 'default' | 'large'
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  showDetails = false,
  size = 'default',
}) => {
  const {
    networkStatus,
    networkInfo,
    queueStats,
    isSyncing,
    syncData,
    showOfflineIndicator,
  } = useOfflineStore()

  // 获取状态图标和颜色
  const getStatusConfig = () => {
    switch (networkStatus) {
      case 'online':
        return {
          icon: <WifiOutlined />,
          color: 'success',
          text: '在线',
          description: '网络连接正常',
        }
      case 'offline':
        return {
          icon: <DisconnectOutlined />,
          color: 'error',
          text: '离线',
          description: '网络连接断开',
        }
      case 'slow':
        return {
          icon: <WifiOutlined />,
          color: 'warning',
          text: '网络缓慢',
          description: `延迟: ${networkInfo.latency}ms`,
        }
      case 'unstable':
        return {
          icon: <ExclamationCircleOutlined />,
          color: 'warning',
          text: '网络不稳定',
          description: '连接不稳定，可能影响使用',
        }
      default:
        return {
          icon: <WifiOutlined />,
          color: 'default',
          text: '未知',
          description: '网络状态未知',
        }
    }
  }

  const statusConfig = getStatusConfig()

  // 如果网络正常且不显示详情，则不显示指示器
  if (!showOfflineIndicator && !showDetails && networkStatus === 'online') {
    return null
  }

  // 处理同步按钮点击
  const handleSyncClick = () => {
    if (!isSyncing && networkStatus !== 'offline') {
      syncData()
    }
  }

  // 渲染详细信息
  const renderDetails = () => {
    if (!showDetails) return null

    return (
      <Space
        direction="vertical"
        size="small"
        className="offline-indicator-details"
      >
        <div>
          <Text type="secondary">网络状态: </Text>
          <Text>{statusConfig.text}</Text>
        </div>

        {networkInfo.type && (
          <div>
            <Text type="secondary">连接类型: </Text>
            <Text>{networkInfo.type}</Text>
          </div>
        )}

        {networkInfo.speed && (
          <div>
            <Text type="secondary">网络速度: </Text>
            <Text>{networkInfo.speed} Mbps</Text>
          </div>
        )}

        {networkInfo.latency && (
          <div>
            <Text type="secondary">延迟: </Text>
            <Text>{networkInfo.latency}ms</Text>
          </div>
        )}

        <div>
          <Text type="secondary">最后检查: </Text>
          <Text>{networkInfo.lastChecked.toLocaleTimeString()}</Text>
        </div>

        {queueStats.totalMessages > 0 && (
          <div>
            <Text type="secondary">待同步消息: </Text>
            <Text>
              {queueStats.pendingMessages}/{queueStats.totalMessages}
            </Text>
          </div>
        )}

        {networkStatus !== 'offline' && (
          <Button
            type="link"
            size="small"
            icon={isSyncing ? <SyncOutlined spin /> : <CloudSyncOutlined />}
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="sync-button"
          >
            {isSyncing ? '同步中...' : '立即同步'}
          </Button>
        )}
      </Space>
    )
  }

  // 简单模式渲染
  const renderSimple = () => {
    const tooltipContent = (
      <div>
        <div>{statusConfig.description}</div>
        {queueStats.totalMessages > 0 && (
          <div>待同步消息: {queueStats.pendingMessages}</div>
        )}
        {networkInfo.lastChecked && (
          <div>最后检查: {networkInfo.lastChecked.toLocaleTimeString()}</div>
        )}
      </div>
    )

    return (
      <Tooltip title={tooltipContent} placement="bottomRight">
        <Badge
          count={queueStats.pendingMessages}
          size="small"
          offset={[8, -8]}
          className="offline-indicator-badge"
        >
          <div className={`offline-indicator-simple ${statusConfig.color}`}>
            {isSyncing ? <SyncOutlined spin /> : statusConfig.icon}
          </div>
        </Badge>
      </Tooltip>
    )
  }

  return (
    <div className={`offline-indicator ${className || ''} size-${size}`}>
      {showDetails ? (
        <div className="offline-indicator-detailed">
          <Space align="center">
            <Badge
              status={statusConfig.color as any}
              text={statusConfig.text}
            />
            {isSyncing && <SyncOutlined spin />}
          </Space>
          {renderDetails()}
        </div>
      ) : (
        renderSimple()
      )}
    </div>
  )
}

export default OfflineIndicator
