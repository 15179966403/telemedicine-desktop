// AI 工具人机确认交互卡片 (ToolConfirmationCard)
import React from 'react'
import { Card, Tag, Button, Space, Typography, Alert } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { PendingToolConfirmation } from '@/types'

const { Text, Paragraph } = Typography

interface ToolConfirmationCardProps {
  confirmation: PendingToolConfirmation
  onResolve: (allowed: boolean) => void
}

export const ToolConfirmationCard: React.FC<ToolConfirmationCardProps> = ({
  confirmation,
  onResolve,
}) => {
  const isCritical = confirmation.securityLevel === 'L3'

  return (
    <Card
      size="small"
      style={{
        margin: '12px 0',
        borderRadius: 8,
        borderColor: isCritical ? '#ff4d4f' : '#faad14',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        background: isCritical ? '#fff1f0' : '#fffbe6',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space>
          {isCritical ? (
            <EditOutlined style={{ color: '#cf1322', fontSize: 16 }} />
          ) : (
            <CloudDownloadOutlined style={{ color: '#d46b08', fontSize: 16 }} />
          )}
          <Text strong style={{ fontSize: 15 }}>
            {confirmation.title}
          </Text>
        </Space>
        <Tag color={isCritical ? 'error' : 'warning'}>
          {isCritical ? 'Level 3 敏感修改 / 需审核' : 'Level 2 资源操作 / 需确认'}
        </Tag>
      </div>

      <Paragraph style={{ margin: '8px 0', color: '#434343' }}>
        {confirmation.description}
      </Paragraph>

      {confirmation.diffPreview && (
        <Alert
          type="warning"
          style={{ marginBottom: 12 }}
          message={
            <div>
              <Text strong>变更内容预览：</Text>
              <div style={{ marginTop: 4, fontFamily: 'monospace' }}>
                {confirmation.diffPreview.after}
              </div>
            </div>
          }
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        <Button
          size="middle"
          icon={<CloseOutlined />}
          onClick={() => onResolve(false)}
        >
          拒绝取消
        </Button>
        <Button
          type="primary"
          danger={isCritical}
          size="middle"
          icon={<CheckOutlined />}
          onClick={() => onResolve(true)}
        >
          {isCritical ? '核准修改' : '允许下载'}
        </Button>
      </div>
    </Card>
  )
}
