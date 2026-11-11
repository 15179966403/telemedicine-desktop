import React, { useState } from 'react'
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
} from '@ant-design/icons'
import type { HealthSchemeRecord } from '@/types'
import { PatientService } from '@/services/patientService'
import { downloadFile } from '@/utils/helpers'

export interface HealthSchemePreviewModalProps {
  visible: boolean
  schemeRecord: HealthSchemeRecord | null
  onClose: () => void
  onEdit?: (record: HealthSchemeRecord) => void
  onDownloadSuccess?: (schemeId: string | number) => void
}

export const HealthSchemePreviewModal: React.FC<HealthSchemePreviewModalProps> = ({
  visible,
  schemeRecord,
  onClose,
  onEdit,
  onDownloadSuccess,
}) => {
  const [downloading, setDownloading] = useState(false)
  const [localDownloadCount, setLocalDownloadCount] = useState<number | null>(null)

  // 当前生效的 PDF 链接（若医师有修改版本则优先医师修改版，否则初版）
  const activePdfUrl = schemeRecord?.doctorFileUrl || schemeRecord?.fileUrl || ''
  const displayDownloadCount =
    localDownloadCount !== null ? localDownloadCount : schemeRecord?.doctorDownload || 0

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

  // 下载 PDF 并上报系统计数
  const handleDownloadAndRecord = async () => {
    if (!schemeRecord || !activePdfUrl) {
      message.warning('该方案暂无有效 PDF 文件地址')
      return
    }

    try {
      setDownloading(true)
      const custName = schemeRecord.customerName || schemeRecord.userName || '客户'
      const schemeTitle = schemeRecord.recordsType === 6 ? '安颐健管方案' : '三师健管方案'
      const timeStr = (schemeRecord.createTime || '').slice(0, 10).replace(/-/g, '')
      const fileName = `${custName}_${schemeTitle}_${timeStr || '方案'}.pdf`

      // 1. 触发文件下载
      downloadFile(activePdfUrl, fileName)

      // 2. 上报后台累计下载次数
      if (schemeRecord.id) {
        await PatientService.getInstance().recordHealthSchemeDownload(schemeRecord.id)
        const updated = (schemeRecord.doctorDownload || 0) + 1
        setLocalDownloadCount(updated)
        onDownloadSuccess?.(schemeRecord.id)
      }

      message.success({
        content: (
          <span>
            <b>方案下载成功！</b> 已记录系统下载计数，您可直接将文件拖拽至企业微信发给客户。
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
            <Tag color="blue">{schemeRecord?.customerName || schemeRecord?.userName || '客户'}</Tag>
            {getAuditStatusTag(schemeRecord?.auditStatus)}
            <Tag color="purple">
              已下载: <b>{displayDownloadCount}</b> 次
            </Tag>
          </Space>
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
        <Button
          key="download"
          type="primary"
          icon={<DownloadOutlined />}
          loading={downloading}
          onClick={handleDownloadAndRecord}
        >
          下载 PDF 并发送给客户
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
        <div style={{ height: '72vh', width: '100%', background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
          <iframe
            src={activePdfUrl}
            title="健管方案 PDF 预览"
            width="100%"
            height="100%"
            style={{ border: 'none' }}
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
