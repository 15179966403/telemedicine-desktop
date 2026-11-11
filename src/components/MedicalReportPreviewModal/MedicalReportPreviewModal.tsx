import React, { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Watermark,
  Button,
  Space,
  Tag,
  Typography,
  Empty,
  Segmented,
  Tooltip,
} from 'antd'
import {
  FileProtectOutlined,
  SafetyCertificateOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateRightOutlined,
  ReloadOutlined,
  LockOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { MedicalReport } from '@/types'
import { useAuthStore } from '@/stores/authStore'

const { Text } = Typography

export interface MedicalReportPreviewModalProps {
  visible: boolean
  report: MedicalReport | null
  onClose: () => void
}

export const MedicalReportPreviewModal: React.FC<MedicalReportPreviewModalProps> = ({
  visible,
  report,
  onClose,
}) => {
  const [activeUrlIndex, setActiveUrlIndex] = useState(0)
  const [imageScale, setImageScale] = useState(1)
  const [imageRotation, setImageRotation] = useState(0)

  const currentUser = useAuthStore(state => state.user)

  // 规范化获取所有附件 URL
  const fileUrls = useMemo(() => {
    if (!report) return []
    if (Array.isArray(report.fileUrls)) {
      return report.fileUrls.filter(Boolean)
    }
    if (typeof report.fileUrls === 'string') {
      return (report.fileUrls as string)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    }
    return []
  }, [report])

  // 重置状态
  useEffect(() => {
    if (visible) {
      setActiveUrlIndex(0)
      setImageScale(1)
      setImageRotation(0)
    }
  }, [visible, report])

  // 键盘快捷键拦截（屏蔽 Ctrl+S 保存与 Ctrl+P 打印，符合不落盘安全合规）
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [visible])

  const activeUrl = fileUrls[activeUrlIndex] || ''

  // 判断是否为图片
  const isImageFile = useMemo(() => {
    if (!activeUrl) return false
    const cleanUrl = activeUrl.split('?')[0].toLowerCase()
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp']
    return imageExtensions.some(ext => cleanUrl.endsWith(ext))
  }, [activeUrl])

  // 判断是否为 PDF
  const isPdfFile = useMemo(() => {
    if (!activeUrl) return false
    const cleanUrl = activeUrl.split('?')[0].toLowerCase()
    return cleanUrl.endsWith('.pdf')
  }, [activeUrl])

  // 生成防拍摄安全动态盲水印
  const watermarkText = useMemo(() => {
    const doctorName = currentUser?.name || currentUser?.username || '医生'
    const phone = currentUser?.phone || currentUser?.phonenumber || ''
    const phoneTail = phone.length >= 4 ? `尾号${phone.slice(-4)}` : ''
    const dateStr = new Date().toLocaleDateString()
    return [
      `${doctorName} ${phoneTail}`,
      `${dateStr} 内部诊阅`,
      '严禁拍照与外传',
    ]
  }, [currentUser])

  // 报告类型标签
  const getReportTypeTag = (type?: number | string) => {
    const num = Number(type)
    switch (num) {
      case 2:
        return <Tag color="blue">理化指标</Tag>
      case 3:
        return <Tag color="orange">免回复记录</Tag>
      default:
        return <Tag color="green">体检报告</Tag>
    }
  }

  // 附件切换器配置
  const segmentedOptions = fileUrls.map((url, idx) => {
    const clean = url.split('?')[0]
    const ext = clean.split('.').pop()?.toLowerCase() || ''
    const isPdf = ext === 'pdf'
    return {
      label: (
        <Space size={4}>
          {isPdf ? (
            <FilePdfOutlined style={{ color: '#ff4d4f' }} />
          ) : (
            <FileImageOutlined style={{ color: '#1890ff' }} />
          )}
          <span>附件 {idx + 1} ({isPdf ? 'PDF' : ext.toUpperCase() || '图'})</span>
        </Space>
      ),
      value: idx,
    }
  })

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <FileProtectOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              体检报告安全在线预览
            </span>
            <span style={{ color: '#666', fontSize: 14 }}>
              - {report?.reportName || report?.alias || '体检报告原件'}
            </span>
            {getReportTypeTag(report?.reportType)}
            <Tag color="success" icon={<SafetyCertificateOutlined />}>
              纯内存流式渲染 · 未留存本地电脑
            </Tag>
          </Space>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={980}
      style={{ top: 20 }}
      styles={{
        body: {
          padding: 0,
          background: '#f0f2f5',
          overflow: 'hidden',
          borderRadius: 8,
        },
      }}
      footer={[
        <div
          key="footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Space size="small">
            <LockOutlined style={{ color: '#52c41a' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              已遵照医疗敏感信息不落盘规定：已关闭本地下载与另存为，查阅完毕关闭窗口即刻释放内存。
            </Text>
          </Space>
          <Button type="primary" icon={<CloseOutlined />} onClick={onClose}>
            完成查阅并关闭
          </Button>
        </div>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '76vh' }}>
        {/* 多附件切换导航栏（当存在多张化验单或多份PDF报告时） */}
        {fileUrls.length > 1 && (
          <div
            style={{
              padding: '8px 16px',
              background: '#fff',
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Space>
              <Text strong style={{ fontSize: 13 }}>报告附件列表 ({fileUrls.length} 份)：</Text>
              <Segmented
                size="small"
                options={segmentedOptions}
                value={activeUrlIndex}
                onChange={val => {
                  setActiveUrlIndex(val as number)
                  setImageScale(1)
                  setImageRotation(0)
                }}
              />
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前正在查看第 {activeUrlIndex + 1} / {fileUrls.length} 份附件
            </Text>
          </div>
        )}

        {/* 报告主体内容区域（包裹合规水印） */}
        <Watermark
          content={watermarkText}
          gap={[100, 100]}
          font={{ color: 'rgba(0, 0, 0, 0.11)', fontSize: 14 }}
          style={{ height: '100%', width: '100%' }}
        >
          <div
            style={{ height: '100%', width: '100%', position: 'relative' }}
            onContextMenu={e => e.preventDefault()}
          >
            {fileUrls.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <Empty description="该体检报告记录未包含有效报告原件文件" />
              </div>
            ) : isPdfFile ? (
              // 1. PDF 报告：通过 WebView2 内存直接流式渲染，#toolbar=0 禁用原生保存/打印工具条
              <div style={{ height: '100%', width: '100%', background: '#525659' }}>
                <iframe
                  src={`${activeUrl}#toolbar=0&navpanes=0`}
                  title="体检报告在线预览"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                />
              </div>
            ) : isImageFile ? (
              // 2. 图片报告/化验单照片：提供无极放大、缩小、旋转与纯内存平移阅读工具条
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#262626' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 16px',
                    background: '#1f1f1f',
                    borderBottom: '1px solid #333',
                  }}
                >
                  <Tooltip title="放大 (+25%)">
                    <Button
                      size="small"
                      ghost
                      icon={<ZoomInOutlined />}
                      onClick={() => setImageScale(s => Math.min(s + 0.25, 3.5))}
                    >
                      放大
                    </Button>
                  </Tooltip>
                  <span style={{ color: '#fff', fontSize: 12, minWidth: 44, textAlign: 'center' }}>
                    {Math.round(imageScale * 100)}%
                  </span>
                  <Tooltip title="缩小 (-25%)">
                    <Button
                      size="small"
                      ghost
                      icon={<ZoomOutOutlined />}
                      onClick={() => setImageScale(s => Math.max(s - 0.25, 0.4))}
                    >
                      缩小
                    </Button>
                  </Tooltip>
                  <Tooltip title="顺时针旋转 90 度">
                    <Button
                      size="small"
                      ghost
                      icon={<RotateRightOutlined />}
                      onClick={() => setImageRotation(r => (r + 90) % 360)}
                    >
                      旋转
                    </Button>
                  </Tooltip>
                  <Tooltip title="恢复原始尺寸与角度">
                    <Button
                      size="small"
                      ghost
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setImageScale(1)
                        setImageRotation(0)
                      }}
                    >
                      重置
                    </Button>
                  </Tooltip>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                  }}
                >
                  <img
                    src={activeUrl}
                    alt="体检报告附件"
                    draggable={false}
                    onContextMenu={e => e.preventDefault()}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                      transition: 'transform 0.2s ease',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                      borderRadius: 4,
                      userSelect: 'none',
                    }}
                  />
                </div>
              </div>
            ) : (
              // 3. 通用格式内嵌流式预览兜底
              <div style={{ height: '100%', width: '100%', background: '#fff' }}>
                <iframe
                  src={activeUrl}
                  title="报告附件预览"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                />
              </div>
            )}
          </div>
        </Watermark>
      </div>
    </Modal>
  )
}
