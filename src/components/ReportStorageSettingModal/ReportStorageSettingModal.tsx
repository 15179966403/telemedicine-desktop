import React, { useEffect, useState } from 'react'
import {
  Modal,
  Input,
  Button,
  Space,
  Alert,
  Typography,
  Descriptions,
  Tag,
  Spin,
  Popconfirm,
  message,
} from 'antd'
import {
  FolderOpenOutlined,
  FolderViewOutlined,
  HddOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { ReportFileService, ReportStorageConfig } from '@/services'

const { Text, Paragraph } = Typography

interface ReportStorageSettingModalProps {
  visible: boolean
  onClose: () => void
  onSaved?: (newPath: string) => void
  onCleaned?: () => void
}

export const ReportStorageSettingModal: React.FC<ReportStorageSettingModalProps> = ({
  visible,
  onClose,
  onSaved,
  onCleaned,
}) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [config, setConfig] = useState<ReportStorageConfig | null>(null)
  const [currentPath, setCurrentPath] = useState('')

  const reportFileService = ReportFileService.getInstance()

  // 加载当前存储路径与磁盘信息
  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await reportFileService.getStorageConfig()
      setConfig(res)
      setCurrentPath(res.rootPath)
    } catch (err) {
      console.error('加载文件存储配置失败:', err)
      message.error('加载文件存储配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      loadConfig()
    }
  }, [visible])

  // 调起系统文件夹选择器
  const handleSelectFolder = async () => {
    try {
      const selected = await reportFileService.selectFolderDialog()
      if (selected && selected.trim()) {
        setCurrentPath(selected.trim())
      }
    } catch (err) {
      console.warn('选择文件夹失败:', err)
      message.error('选择文件夹失败')
    }
  }

  // 在 Windows 资源管理器中打开当前目录
  const handleOpenFolder = async () => {
    if (!currentPath) return
    try {
      await reportFileService.openLocalFolder(currentPath)
    } catch (err) {
      message.error('打开目录失败')
    }
  }

  // 保存新路径
  const handleSave = async () => {
    if (!currentPath.trim()) {
      message.warning('存储路径不能为空')
      return
    }
    setSaving(true)
    try {
      const updated = await reportFileService.setStorageConfig(currentPath.trim())
      setConfig(updated)
      message.success('体检报告存储路径已更新')
      onSaved?.(updated.rootPath)
      onClose()
    } catch (err) {
      console.error('保存存储路径失败:', err)
      message.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // 一键清理本地所有报告文件
  const handleCleanAllFiles = async () => {
    setCleaning(true)
    try {
      const res = await reportFileService.cleanAllReportFiles()
      setConfig(res.config)
      message.success(
        `本地客户档案文件已清理完成（已清除 ${res.cleanedItemsCount} 项报告/方案文件与目录，磁盘空间已释放）`
      )
      onCleaned?.()
    } catch (err) {
      console.error('清理本地文件失败:', err)
      message.error(`清理失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCleaning(false)
    }
  }

  const isLowSpace = config ? config.diskFreeGb < 5.0 : false

  return (
    <Modal
      title={
        <Space>
          <FolderOpenOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <span style={{ fontWeight: 600 }}>客户健康档案本地存储与清理设置</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={saving}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={saving}
          onClick={handleSave}
          disabled={loading}
        >
          保存设置
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <div style={{ marginTop: 8 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="客户档案本地化统一存储说明"
            description={
              <Paragraph style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#595959' }}>
                系统已默认探测非系统盘（D盘或E盘），下载的<b>体检报告</b>与<b>健管方案</b>将统一合并归档至客户专属目录：
                <br />
                <Text code style={{ margin: '2px 0', display: 'inline-block' }}>
                  [根存储目录] / [客户姓名_手机尾号_档案ID] / [体检报告 | 健管方案] / 文件名.pdf
                </Text>
                <br />
                全流程集中规范存放，方案文件名彻底脱敏去手机号，不污染系统 C 盘。
              </Paragraph>
            }
          />

          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              客户档案本地根保存目录：
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={currentPath}
                onChange={e => setCurrentPath(e.target.value)}
                placeholder="例如: D:\健康管理桌面端_客户档案库"
                style={{ fontFamily: 'Consolas, monospace', fontSize: 13 }}
              />
              <Button icon={<FolderOpenOutlined />} onClick={handleSelectFolder}>
                选择目录
              </Button>
              <Button icon={<FolderViewOutlined />} onClick={handleOpenFolder}>
                打开目录
              </Button>
            </Space.Compact>
          </div>

          {config && (
            <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="磁盘剩余可用空间">
                <Space>
                  <HddOutlined style={{ color: isLowSpace ? '#fa8c16' : '#52c41a' }} />
                  <Text strong style={{ color: isLowSpace ? '#fa8c16' : '#1f1f1f' }}>
                    {config.diskFreeGb} GB
                  </Text>
                  {isLowSpace ? (
                    <Tag icon={<ExclamationCircleOutlined />} color="warning">
                      磁盘空间不足 5GB，建议清理或切换分区
                    </Tag>
                  ) : (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                      空间充足
                    </Tag>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="路径配置状态">
                <Tag color={config.isCustom ? 'blue' : 'default'}>
                  {config.isCustom ? '医生自定义路径' : '系统智能推荐路径'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* 本地文件清除与合规清理模块 */}
          <div
            style={{
              background: '#fff2f0',
              padding: '12px 14px',
              borderRadius: 6,
              border: '1px solid #ffccc7',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: '#cf1322', fontSize: 13, marginBottom: 2 }}>
                <ClearOutlined style={{ marginRight: 6 }} />
                本地客户档案文件清理（体检报告 + 健管方案）
              </div>
              <div style={{ fontSize: 12, color: '#820014' }}>
                按合规要求（电脑不留存客户信息）或需释放磁盘空间时，可一键彻底擦除本机所有已下载文件
              </div>
            </div>
            <Popconfirm
              title="确定要彻底清除本地所有客户档案文件吗？"
              description="清理将删除本机存储目录下的所有体检报告与健管方案文件，云端档案完好无损，随时可在线安全查阅或重新下载。"
              okText="确认彻底清理"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: cleaning }}
              onConfirm={handleCleanAllFiles}
            >
              <Button danger icon={<DeleteOutlined />} loading={cleaning}>
                一键清理本地文件
              </Button>
            </Popconfirm>
          </div>

          <div
            style={{
              background: '#fafafa',
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px dashed #d9d9d9',
              fontSize: 12,
              color: '#8c8c8c',
            }}
          >
            <div>
              💡 <strong>提示：</strong>
              修改保存路径后，新下载的报告与方案将存入新目录；先前已下载的历史文件仍保留在原目录中。如需清理电脑残留，可点击上方“一键清理”。
            </div>
          </div>
        </div>
      </Spin>
    </Modal>
  )
}
