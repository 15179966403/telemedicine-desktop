/**
 * 同步冲突解决组件
 * Sync conflict resolver component
 */

import React, { useState } from 'react'
import {
  Modal,
  Card,
  Space,
  Button,
  Radio,
  Typography,
  Descriptions,
  Alert,
  Divider,
  Tag,
  message,
} from 'antd'
import {
  ExclamationCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  MergeOutlined,
} from '@ant-design/icons'
import { useOfflineStore } from '@/stores/offlineStore'
import type { SyncConflict } from '@/services/offlineService'
import './SyncConflictResolver.css'

const { Title, Text, Paragraph } = Typography

export interface SyncConflictResolverProps {
  visible: boolean
  onClose: () => void
  conflict?: SyncConflict
}

export const SyncConflictResolver: React.FC<SyncConflictResolverProps> = ({
  visible,
  onClose,
  conflict,
}) => {
  const { resolveSyncConflict } = useOfflineStore()
  const [resolution, setResolution] = useState<'local' | 'remote' | 'merge'>(
    'local'
  )
  const [loading, setLoading] = useState(false)

  if (!conflict) {
    return null
  }

  // 处理冲突解决
  const handleResolve = async () => {
    try {
      setLoading(true)

      let mergedData
      if (resolution === 'merge') {
        // 简单的合并策略：优先使用本地数据，但保留远程数据的某些字段
        mergedData = {
          ...conflict.localData,
          // 保留远程数据的更新时间等元数据
          updatedAt: conflict.remoteData.updatedAt,
          version: conflict.remoteData.version,
        }
      }

      await resolveSyncConflict(conflict.id, resolution, mergedData)

      message.success('冲突已解决')
      onClose()
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      message.error('解决冲突失败')
    } finally {
      setLoading(false)
    }
  }

  // 渲染数据对比
  const renderDataComparison = () => {
    const localData = conflict.localData
    const remoteData = conflict.remoteData
    const conflictFields = conflict.conflictFields

    return (
      <div className="data-comparison">
        <div className="comparison-header">
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <Text strong>数据冲突详情</Text>
          </Space>
        </div>

        <div className="comparison-content">
          <div className="comparison-section">
            <Card
              title={
                <Space>
                  <Tag color="blue">本地数据</Tag>
                  <Text type="secondary">
                    {new Date(conflict.timestamp).toLocaleString()}
                  </Text>
                </Space>
              }
              size="small"
              className="local-data-card"
            >
              <Descriptions column={1} size="small">
                {Object.entries(localData).map(([key, value]) => (
                  <Descriptions.Item
                    key={key}
                    label={key}
                    className={
                      conflictFields.includes(key) ? 'conflict-field' : ''
                    }
                  >
                    <Text code={conflictFields.includes(key)}>
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </Text>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          </div>

          <div className="comparison-divider">
            <Divider type="vertical" style={{ height: '100%' }} />
          </div>

          <div className="comparison-section">
            <Card
              title={
                <Space>
                  <Tag color="green">远程数据</Tag>
                  <Text type="secondary">服务器最新版本</Text>
                </Space>
              }
              size="small"
              className="remote-data-card"
            >
              <Descriptions column={1} size="small">
                {Object.entries(remoteData).map(([key, value]) => (
                  <Descriptions.Item
                    key={key}
                    label={key}
                    className={
                      conflictFields.includes(key) ? 'conflict-field' : ''
                    }
                  >
                    <Text code={conflictFields.includes(key)}>
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </Text>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          </div>
        </div>

        {conflictFields.length > 0 && (
          <Alert
            type="warning"
            message="冲突字段"
            description={
              <Space wrap>
                {conflictFields.map(field => (
                  <Tag key={field} color="orange">
                    {field}
                  </Tag>
                ))}
              </Space>
            }
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    )
  }

  // 渲染解决方案选择
  const renderResolutionOptions = () => {
    return (
      <div className="resolution-options">
        <Title level={5}>选择解决方案</Title>
        <Radio.Group
          value={resolution}
          onChange={e => setResolution(e.target.value)}
          className="resolution-radio-group"
        >
          <Space direction="vertical" size="middle">
            <Radio value="local">
              <Space>
                <CheckOutlined style={{ color: '#52c41a' }} />
                <div>
                  <Text strong>使用本地数据</Text>
                  <br />
                  <Text type="secondary">保留本地修改，覆盖服务器数据</Text>
                </div>
              </Space>
            </Radio>

            <Radio value="remote">
              <Space>
                <CloseOutlined style={{ color: '#ff4d4f' }} />
                <div>
                  <Text strong>使用远程数据</Text>
                  <br />
                  <Text type="secondary">丢弃本地修改，使用服务器最新数据</Text>
                </div>
              </Space>
            </Radio>

            <Radio value="merge">
              <Space>
                <MergeOutlined style={{ color: '#1890ff' }} />
                <div>
                  <Text strong>智能合并</Text>
                  <br />
                  <Text type="secondary">尝试合并两个版本的数据</Text>
                </div>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          数据同步冲突
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      className="sync-conflict-resolver"
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="resolve"
          type="primary"
          loading={loading}
          onClick={handleResolve}
        >
          解决冲突
        </Button>,
      ]}
    >
      <div className="conflict-resolver-content">
        <Alert
          type="warning"
          message="检测到数据同步冲突"
          description={
            <Paragraph>
              在同步 <Text code>{conflict.type}</Text> 数据时发现冲突。
              本地数据与服务器数据不一致，请选择如何处理这个冲突。
            </Paragraph>
          }
          style={{ marginBottom: 24 }}
        />

        {renderDataComparison()}

        <Divider />

        {renderResolutionOptions()}
      </div>
    </Modal>
  )
}

export default SyncConflictResolver
