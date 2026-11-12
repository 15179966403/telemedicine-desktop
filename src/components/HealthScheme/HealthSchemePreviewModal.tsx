import React, { useState, useEffect } from 'react'
import {
  Modal,
  Button,
  Space,
  Tag,
  Empty,
  message,
  Tooltip,
} from 'antd'
import {
  FilePdfOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import type { HealthSchemeRecord } from '@/types'
import { PatientService } from '@/services/patientService'
import { ReportFileService, SchemeStatusResult } from '@/services/reportFileService'
import { buildHealthSchemeFileName, downloadFile } from '@/utils/helpers'
import { PdfViewer } from '@/components/PdfViewer'

export interface HealthSchemePreviewModalProps {
  visible: boolean
  schemeRecord: HealthSchemeRecord | null
  customer?: {
    id?: string | number
    customerId?: string | number
    customerName?: string
    mobile?: string
  } | null
  onClose: () => void
  onEdit?: (record: HealthSchemeRecord) => void
  onDownloadSuccess?: (schemeId: string | number) => void
}

export const HealthSchemePreviewModal: React.FC<HealthSchemePreviewModalProps> = ({
  visible,
  schemeRecord,
  customer,
  onClose,
  onEdit,
  onDownloadSuccess,
}) => {
  const [downloading, setDownloading] = useState(false)
  const [localDownloadCount, setLocalDownloadCount] = useState<number | null>(null)
  const [localStatus, setLocalStatus] = useState<SchemeStatusResult | null>(null)

  const reportFileService = ReportFileService.getInstance()

  // 当前生效的 PDF 链接（若医师有修改版本则优先医师修改版，否则初版）
  const activePdfUrl = schemeRecord?.doctorFileUrl || schemeRecord?.fileUrl || ''
  const displayDownloadCount =
    localDownloadCount !== null ? localDownloadCount : schemeRecord?.doctorDownload || 0

  // 客户信息提取
  const custName = schemeRecord?.customerName || schemeRecord?.userName || customer?.customerName || '客户'
  const custMobile = schemeRecord?.mobile || customer?.mobile || ''
  const custId = customer?.id ?? customer?.customerId ?? schemeRecord?.customerId ?? schemeRecord?.id ?? ''

  // 检查本地电脑是否存在该方案
  const checkStatus = async () => {
    if (!schemeRecord || !schemeRecord.id) return
    try {
      const fileName = buildHealthSchemeFileName(schemeRecord)
      const st = await reportFileService.checkSchemeStatus({
        customerName: custName,
        mobile: custMobile,
        customerId: custId,
        schemeId: schemeRecord.id,
        fileName,
      })
      setLocalStatus(st)
    } catch (err) {
      console.warn('检查方案本地存储状态失败:', err)
    }
  }

  useEffect(() => {
    if (visible && schemeRecord) {
      checkStatus()
    } else {
      setLocalStatus(null)
      setLocalDownloadCount(null)
    }
  }, [visible, schemeRecord])

  // 状态渲染
  const getAuditStatusTag = (status?: number) => {
    switch (status) {
      case 0:
        return <Tag color="default"><ClockCircleOutlined /> 待审核</Tag>
      case 1:
        return <Tag color="cyan"><CheckCircleOutlined /> 营养师通过</Tag>
      case 2:
        return <Tag color="error"><CloseCircleOutlined /> 营养师驳回</Tag>
      case 3:
        return <Tag color="success"><CheckCircleOutlined /> 医师通过</Tag>
      case 4:
        return <Tag color="error"><CloseCircleOutlined /> 医师驳回</Tag>
      case 5:
        return <Tag color="warning"><ClockCircleOutlined /> 数据不全</Tag>
      default:
        return <Tag color="default">方案已生成</Tag>
    }
  }

  // 打开本地文件夹定位
  const handleOpenFolder = async () => {
    if (!localStatus) return
    try {
      await reportFileService.openLocalFolder(
        localStatus.schemeDir,
        localStatus.exists ? localStatus.localPath : undefined
      )
    } catch (err) {
      message.error('定位本地文件失败')
    }
  }

  // 下载 PDF 并上报系统计数（存入本地统一客户专属目录）
  const handleDownloadAndRecord = async () => {
    if (!schemeRecord || !activePdfUrl) {
      message.warning('该方案暂无有效 PDF 文件地址')
      return
    }

    try {
      setDownloading(true)
      // 使用脱敏去手机号规范格式构建文件名
      const fileName = buildHealthSchemeFileName(schemeRecord)

      // 1. 调用 Rust 命令下载到本地客户目录的“健管方案”子文件夹
      let downloadSucceeded = false
      try {
        const downloadRes = await reportFileService.downloadSchemeFile({
          customerName: custName,
          mobile: custMobile,
          customerId: custId,
          schemeId: schemeRecord.id,
          fileUrl: activePdfUrl,
          fileName,
        })
        if (downloadRes.success) {
          downloadSucceeded = true
        }
      } catch (err) {
        console.warn('Tauri 本地下载失败，降级浏览器下载:', err)
      }

      // 降级兜底：如果不在 Tauri 环境则触发常规文件下载
      if (!downloadSucceeded) {
        downloadFile(activePdfUrl, fileName)
      }

      // 2. 上报后台累计下载次数
      if (schemeRecord.id) {
        await PatientService.getInstance().recordHealthSchemeDownload(schemeRecord.id)
        const updated = (schemeRecord.doctorDownload || 0) + 1
        setLocalDownloadCount(updated)
        onDownloadSuccess?.(schemeRecord.id)
      }

      // 3. 刷新本地状态
      await checkStatus()

      message.success({
        content: (
          <span>
            <b>方案已保存至客户专属文件夹！</b> 已记录系统下载计数，您可直接拖入企业微信发送给客户。
          </span>
        ),
        duration: 4,
      })
    } catch (err) {
      message.error(`下载失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              健管方案预览
            </span>
            <Tag color="blue">{custName}</Tag>
            {getAuditStatusTag(schemeRecord?.auditStatus)}
            {localStatus?.exists && (
              <Tag color="success">
                <CheckCircleOutlined /> 本地已就绪
              </Tag>
            )}
            <Tag color="purple">
              已下载: <b>{displayDownloadCount}</b> 次
            </Tag>
          </Space>
          <Space>
            {localStatus?.exists && (
              <Tooltip title="在 Windows 资源管理器中高亮定位该方案文件">
                <Button
                  type="link"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenFolder}
                >
                  定位文件
                </Button>
              </Tooltip>
            )}
            {activePdfUrl && (
              <Tooltip title="在独立浏览器窗口打开">
                <Button
                  type="link"
                  size="small"
                  icon={<ExportOutlined />}
                  onClick={() => window.open(activePdfUrl, '_blank')}
                >
                  外跳打开
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>
      }
      open={visible}
      onCancel={() => {
        setLocalDownloadCount(null)
        onClose()
      }}
      width={900}
      style={{ top: 20 }}
      styles={{ body: { padding: '8px 16px', background: '#f5f5f5' } }}
      footer={[
        <Button
          key="edit"
          icon={<EditOutlined />}
          onClick={() => {
            if (schemeRecord && onEdit) {
              onEdit(schemeRecord)
            }
          }}
        >
          修改方案内容
        </Button>,
        localStatus?.exists && (
          <Button
            key="locate"
            icon={<FolderOpenOutlined />}
            onClick={handleOpenFolder}
          >
            打开本地方案目录
          </Button>
        ),
        <Button
          key="download"
          type="primary"
          icon={<DownloadOutlined />}
          loading={downloading}
          onClick={handleDownloadAndRecord}
        >
          {localStatus?.exists ? '重新归档并发送' : '下载 PDF 并发送给客户'}
        </Button>,
        <Button
          key="close"
          onClick={() => {
            setLocalDownloadCount(null)
            onClose()
          }}
        >
          关闭
        </Button>,
      ]}
    >
      {activePdfUrl ? (
        <div style={{ height: '74vh', width: '100%', background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
          <PdfViewer
            fileUrl={localStatus?.exists && localStatus.localPath ? localStatus.localPath : activePdfUrl}
            watermarkText={`仅供内部健管查阅 · ${custName}`}
            height="100%"
          />
        </div>
      ) : (
        <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
          <Empty
            description={
              schemeRecord?.async === 1 ? (
                <span>
                  <SyncOutlined spin style={{ marginRight: 6, color: '#1890ff' }} />
                  该方案正由系统后台重新排版生成中，请等待约30秒后刷新查看...
                </span>
              ) : (
                '该健管方案暂未生成有效 PDF 附件文件'
              )
            }
          />
        </div>
      )}
    </Modal>
  )
}
