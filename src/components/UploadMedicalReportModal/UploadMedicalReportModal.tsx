import React, { useState } from 'react'
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Radio,
  Upload,
  Button,
  Space,
  Typography,
  Card,
  message,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  CloudUploadOutlined,
  InboxOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  PaperClipOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { CustomerRecord } from '@/types'
import { PatientService } from '@/services/patientService'
import { resolveCustomerDisplayName } from '@/components/AppointmentModal/AppointmentModal'

const { Text } = Typography

interface UploadMedicalReportModalProps {
  visible: boolean
  customer: CustomerRecord | null
  onClose: () => void
  onSuccess: () => void
}

interface FormValues {
  reportName: string
  medicalOrg: string
  reportTime: dayjs.Dayjs
  reportType: number
}

export const UploadMedicalReportModal: React.FC<UploadMedicalReportModalProps> = ({
  visible,
  customer,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm<FormValues>()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [progressText, setProgressText] = useState('')

  const handleClose = () => {
    if (submitting) return
    form.resetFields()
    setFileList([])
    setProgressText('')
    onClose()
  }

  // 提交上传与保存
  const handleSubmit = async () => {
    if (!customer) {
      message.error('未指定关联客户')
      return
    }

    const customerArchiveId = customer.id ?? customer.customerId
    if (customerArchiveId == null || customerArchiveId === '') {
      message.error('当前客户缺少系统档案编号，无法上传报告')
      return
    }

    try {
      const values = await form.validateFields()

      if (fileList.length === 0) {
        message.warning('请至少添加一份体检报告或化验单文件（图片或 PDF）')
        return
      }

      setSubmitting(true)
      const patientService = PatientService.getInstance()
      const uploadedUrls: string[] = []

      // 依次上传附件到后台文件服务
      for (let i = 0; i < fileList.length; i++) {
        const item = fileList[i]
        setProgressText(`正在上传附件 (${i + 1}/${fileList.length})：${item.name}...`)

        // 获取实际的 File 二进制对象
        const fileObj = (item.originFileObj || item) as File
        if (!fileObj || !(fileObj instanceof File)) {
          console.warn('Invalid file object:', item)
          continue
        }

        const url = await patientService.uploadReportAttachment(fileObj)
        uploadedUrls.push(url)
      }

      if (uploadedUrls.length === 0) {
        throw new Error('未能成功上传任何文件')
      }

      // 保存体检报告档案记录
      setProgressText('正在同步至客户健康档案...')
      await patientService.addCustomerReport({
        customerId: customerArchiveId,
        fileUrls: uploadedUrls,
        reportName: values.reportName.trim(),
        reportTime: values.reportTime.format('YYYY-MM-DD'),
        medicalOrg: values.medicalOrg.trim(),
        reportType: values.reportType,
        alias: values.reportName.trim(),
        associatRecord: 0,
      })

      message.success(`体检报告上传成功！共归档 ${uploadedUrls.length} 个附件`)
      handleClose()
      onSuccess()
    } catch (err: any) {
      console.error('Upload report failed:', err)
      message.error(`报告提交失败: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
      setProgressText('')
    }
  }

  return (
    <Modal
      title={
        <Space>
          <CloudUploadOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>为客户上传体检报告</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      maskClosable={!submitting}
      destroyOnClose
      width={640}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={submitting}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CloudUploadOutlined />}
          loading={submitting}
          onClick={handleSubmit}
        >
          {submitting ? progressText || '正在上传...' : '确定上传并归档'}
        </Button>,
      ]}
    >
      {/* 客户信息卡片 */}
      {customer && (
        <Card
          size="small"
          style={{
            background: '#f8fafd',
            border: '1px solid #e6f0fa',
            borderRadius: 6,
            marginBottom: 16,
          }}
          styles={{ body: { padding: '10px 14px' } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>归档客户：</Text>
              <Text strong style={{ fontSize: 14, marginLeft: 4 }}>
                {resolveCustomerDisplayName(customer)}
              </Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {customer.mobile ? `(${customer.mobile})` : ''}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>档案编号：</Text>
              <Text code style={{ fontSize: 12 }}>
                {String(customer.id ?? customer.customerId ?? '-')}
              </Text>
            </div>
          </div>
        </Card>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          reportName: '体检报告',
          reportType: 1,
          reportTime: dayjs(),
          medicalOrg: '',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item
            label="报告名称"
            name="reportName"
            rules={[{ required: true, message: '请输入报告名称' }]}
          >
            <Input placeholder="例如: 2026年度体检报告 / 生化专项化验单" maxLength={50} />
          </Form.Item>

          <Form.Item
            label="体检机构"
            name="medicalOrg"
            rules={[
              { required: true, message: '请输入体检机构' },
              { max: 50, message: '机构名称最多50个字符' },
            ]}
          >
            <Input placeholder="例如: 美年大健康 / 爱康国宾 / 省人民医院" maxLength={50} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item
            label="体检日期"
            name="reportTime"
            rules={[{ required: true, message: '请选择体检日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="选择体检日期" />
          </Form.Item>

          <Form.Item label="报告类型" name="reportType" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value={1}>体检报告</Radio>
              <Radio value={2}>理化/反馈指标</Radio>
              <Radio value={3}>无就医记录</Radio>
            </Radio.Group>
          </Form.Item>
        </div>

        <Form.Item
          label={
            <Space>
              <span>报告原件附件 (支持微信/本地拖拽)</span>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                已选 {fileList.length} 份文件
              </Text>
            </Space>
          }
          required
        >
          <Upload.Dragger
            name="file"
            multiple
            fileList={fileList}
            accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf"
            beforeUpload={file => {
              // 限制单文件 50MB
              if (file.size > 50 * 1024 * 1024) {
                message.error(`文件 ${file.name} 超过 50MB 限制`)
                return Upload.LIST_IGNORE
              }
              setFileList(prev => [...prev, file as unknown as UploadFile])
              return false // 阻止 antd 自动上传，在点击确定时统一提交
            }}
            onRemove={file => {
              setFileList(prev => prev.filter(item => item.uid !== file.uid))
            }}
            itemRender={(_originNode, file) => {
              const ext = file.name.split('.').pop()?.toLowerCase() || ''
              const isPdf = ext === 'pdf'
              const sizeKb = file.size ? Math.round(file.size / 1024) : 0
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 4,
                    background: '#f9f9f9',
                    border: '1px solid #f0f0f0',
                    marginTop: 6,
                  }}
                >
                  <Space>
                    {isPdf ? (
                      <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                    ) : (
                      <FileImageOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                    )}
                    <Text ellipsis style={{ maxWidth: 360, fontSize: 13 }}>
                      {file.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ({sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`})
                    </Text>
                  </Space>
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => setFileList(prev => prev.filter(item => item.uid !== file.uid))}
                  >
                    移除
                  </Button>
                </div>
              )
            }}
            style={{ padding: '16px 0', background: '#fafcff' }}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
              <InboxOutlined style={{ fontSize: 38, color: '#1677ff' }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              点击选择文件，或直接从微信/文件夹中拖拽至此处
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 12, color: '#888' }}>
              <PaperClipOutlined style={{ marginRight: 4 }} />
              支持 JPG、PNG、WebP 图片及 PDF 文件，单文件大小不超过 50MB
            </p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  )
}
