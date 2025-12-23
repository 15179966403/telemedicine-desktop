import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  List,
  Modal,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CloseOutlined,
  ExpandOutlined,
  MinusOutlined,
  EyeOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useWindowStore } from '@/stores'
import type { WindowInfo, ResourceUsage } from '@/types'
import './WindowManager.css'

const { Text, Title } = Typography

interface WindowManagerProps {
  visible: boolean
  onClose: () => void
}

export const WindowManager: React.FC<WindowManagerProps> = ({
  visible,
  onClose,
}) => {
  const {
    getAllWindows,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    getResourceUsage,
  } = useWindowStore()

  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null)
  const [loading, setLoading] = useState(false)

  // 刷新窗口列表和资源使用情况
  const refreshData = async () => {
    setLoading(true)
    try {
      const [windowList, usage] = await Promise.all([
        getAllWindows(),
        getResourceUsage(),
      ])
      setWindows(windowList)
      setResourceUsage(usage)
    } catch (error) {
      console.error('Failed to refresh window data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      refreshData()
      // 每5秒刷新一次数据
      const interval = setInterval(refreshData, 5000)
      return () => clearInterval(interval)
    }
  }, [visible])

  const handleCloseWindow = async (windowId: string) => {
    try {
      await closeWindow(windowId)
      await refreshData()
    } catch (error) {
      console.error('Failed to close window:', error)
    }
  }

  const handleFocusWindow = async (windowId: string) => {
    try {
      await focusWindow(windowId)
      onClose() // 关闭窗口管理器
    } catch (error) {
      console.error('Failed to focus window:', error)
    }
  }

  const handleMinimizeWindow = async (windowId: string) => {
    try {
      await minimizeWindow(windowId)
      await refreshData()
    } catch (error) {
      console.error('Failed to minimize window:', error)
    }
  }

  const handleMaximizeWindow = async (windowId: string) => {
    try {
      await maximizeWindow(windowId)
      await refreshData()
    } catch (error) {
      console.error('Failed to maximize window:', error)
    }
  }

  const getWindowTypeTag = (type: string) => {
    const typeMap = {
      main: { color: 'blue', text: '工作台' },
      consultation: { color: 'green', text: '问诊' },
      patient_detail: { color: 'orange', text: '患者详情' },
      settings: { color: 'purple', text: '设置' },
    }
    const config = typeMap[type as keyof typeof typeMap] || {
      color: 'default',
      text: type,
    }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const getStateTag = (state: string) => {
    const stateMap = {
      normal: { color: 'success', text: '正常' },
      minimized: { color: 'warning', text: '最小化' },
      maximized: { color: 'processing', text: '最大化' },
    }
    const config = stateMap[state as keyof typeof stateMap] || {
      color: 'default',
      text: state,
    }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getMemoryUsageColor = (usage: number) => {
    if (usage < 200) return 'success'
    if (usage < 400) return 'warning'
    return 'exception'
  }

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined />
          窗口管理器
          {resourceUsage && (
            <Tag color={windows.length > 6 ? 'warning' : 'success'}>
              {windows.length} 个窗口
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="refresh" onClick={refreshData} loading={loading}>
          刷新
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={800}
      className="window-manager-modal"
    >
      <div className="window-manager-content">
        {/* 资源使用情况 */}
        {resourceUsage && (
          <Card size="small" className="resource-usage-card">
            <Title level={5}>资源使用情况</Title>
            <div className="resource-metrics">
              <div className="metric-item">
                <Text type="secondary">内存使用</Text>
                <Progress
                  percent={Math.min(
                    (resourceUsage.memoryUsage / 512) * 100,
                    100
                  )}
                  status={getMemoryUsageColor(resourceUsage.memoryUsage)}
                  format={() => `${resourceUsage.memoryUsage}MB`}
                />
              </div>
              <div className="metric-item">
                <Text type="secondary">窗口数量</Text>
                <Space>
                  <Text strong>{resourceUsage.windowCount}</Text>
                  <Text type="secondary">/ 8 最大</Text>
                  {resourceUsage.consultationWindowCount > 0 && (
                    <Tag color="green">
                      {resourceUsage.consultationWindowCount} 个问诊窗口
                    </Tag>
                  )}
                </Space>
              </div>
            </div>
          </Card>
        )}

        {/* 窗口列表 */}
        <Card size="small" title="活动窗口" className="window-list-card">
          <List
            dataSource={windows}
            loading={loading}
            locale={{ emptyText: '暂无活动窗口' }}
            renderItem={window => (
              <List.Item
                key={window.id}
                className="window-list-item"
                actions={[
                  <Tooltip title="聚焦窗口">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => handleFocusWindow(window.id)}
                    />
                  </Tooltip>,
                  <Tooltip title="最小化">
                    <Button
                      type="text"
                      icon={<MinusOutlined />}
                      onClick={() => handleMinimizeWindow(window.id)}
                      disabled={window.state === 'minimized'}
                    />
                  </Tooltip>,
                  <Tooltip title="最大化">
                    <Button
                      type="text"
                      icon={<ExpandOutlined />}
                      onClick={() => handleMaximizeWindow(window.id)}
                      disabled={window.state === 'maximized'}
                    />
                  </Tooltip>,
                  <Tooltip title="关闭窗口">
                    <Button
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleCloseWindow(window.id)}
                      disabled={window.type === 'main'} // 主窗口不能关闭
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {getWindowTypeTag(window.type)}
                      <Text strong>{window.title}</Text>
                      {getStateTag(window.state)}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary" className="window-url">
                        {window.url}
                      </Text>
                      <Space>
                        <Text type="secondary">
                          创建时间: {formatTime(window.createdAt)}
                        </Text>
                        <Text type="secondary">
                          最后聚焦: {formatTime(window.lastFocused)}
                        </Text>
                      </Space>
                      {window.data && Object.keys(window.data).length > 0 && (
                        <div className="window-data">
                          {Object.entries(window.data).map(([key, value]) => (
                            <Tag key={key} className="data-tag">
                              {key}: {String(value)}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        {/* 警告信息 */}
        {resourceUsage && resourceUsage.windowCount > 6 && (
          <Card size="small" className="warning-card">
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              <Text type="warning">
                当前窗口数量较多，可能影响系统性能。建议关闭不必要的窗口。
              </Text>
            </Space>
          </Card>
        )}
      </div>
    </Modal>
  )
}

export default WindowManager
