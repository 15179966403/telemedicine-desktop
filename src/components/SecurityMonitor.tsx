// 安全监控组件

import { useEffect } from 'react'
import {
  Badge,
  Card,
  List,
  Tag,
  Button,
  Space,
  Typography,
  Tooltip,
} from 'antd'
import {
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useSecurity } from '../hooks/useSecurity'
import { securityService } from '../services/securityService'
import type { AnomalyRecord, AnomalySeverity } from '../types/security'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const { Text, Title } = Typography

interface SecurityMonitorProps {
  userId: string
}

const getSeverityColor = (severity: AnomalySeverity): string => {
  const colors: Record<AnomalySeverity, string> = {
    low: 'blue',
    medium: 'orange',
    high: 'red',
    critical: 'purple',
  }
  return colors[severity]
}

const getSeverityText = (severity: AnomalySeverity): string => {
  const texts: Record<AnomalySeverity, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '严重',
  }
  return texts[severity]
}

const getAnomalyTypeText = (type: string): string => {
  const types: Record<string, string> = {
    MultipleFailedLogins: '多次登录失败',
    UnusualAccessPattern: '异常访问模式',
    SuspiciousFileAccess: '可疑文件访问',
    RapidDataAccess: '快速数据访问',
    UnauthorizedAccess: '未授权访问',
  }
  return types[type] || type
}

export const SecurityMonitor: React.FC<SecurityMonitorProps> = ({ userId }) => {
  const { anomalies, loadAnomalies } = useSecurity(userId)

  useEffect(() => {
    loadAnomalies()
    // 每分钟刷新一次
    const interval = setInterval(loadAnomalies, 60000)
    return () => clearInterval(interval)
  }, [loadAnomalies])

  const handleResolve = async (anomalyId: string) => {
    try {
      await securityService.resolveAnomaly(anomalyId)
      loadAnomalies()
    } catch (error) {
      console.error('标记异常已解决失败:', error)
    }
  }

  const unresolvedCount = anomalies.filter(a => !a.resolved).length

  return (
    <Card
      title={
        <Space>
          <WarningOutlined />
          <span>安全监控</span>
          {unresolvedCount > 0 && (
            <Badge
              count={unresolvedCount}
              style={{ backgroundColor: '#ff4d4f' }}
            />
          )}
        </Space>
      }
      extra={
        <Tooltip title="刷新">
          <Button type="text" onClick={loadAnomalies}>
            刷新
          </Button>
        </Tooltip>
      }
    >
      {anomalies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircleOutlined
            style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }}
          />
          <Title level={5}>暂无安全异常</Title>
          <Text type="secondary">系统运行正常</Text>
        </div>
      ) : (
        <List
          dataSource={anomalies}
          renderItem={(anomaly: AnomalyRecord) => (
            <List.Item
              actions={[
                !anomaly.resolved && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleResolve(anomaly.id)}
                  >
                    标记已解决
                  </Button>
                ),
              ]}
            >
              <List.Item.Meta
                avatar={
                  anomaly.resolved ? (
                    <CheckCircleOutlined
                      style={{ fontSize: 24, color: '#52c41a' }}
                    />
                  ) : (
                    <WarningOutlined
                      style={{
                        fontSize: 24,
                        color: getSeverityColor(anomaly.severity),
                      }}
                    />
                  )
                }
                title={
                  <Space>
                    <span>{getAnomalyTypeText(anomaly.anomaly_type)}</span>
                    <Tag color={getSeverityColor(anomaly.severity)}>
                      {getSeverityText(anomaly.severity)}
                    </Tag>
                    {anomaly.resolved && <Tag color="success">已解决</Tag>}
                  </Space>
                }
                description={
                  <Space direction="vertical" size="small">
                    <Text>{anomaly.description}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <ClockCircleOutlined />{' '}
                      {formatDistanceToNow(new Date(anomaly.detected_at), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
