import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Modal,
  Watermark,
  Button,
  Space,
  Tag,
  Typography,
  Empty,
  Select,
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
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import type { MedicalReport } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { PdfViewer } from '@/components/PdfViewer'

const { Text } = Typography

export interface MedicalReportPreviewModalProps {
  visible: boolean
  report: MedicalReport | null
  onClose: () => void
  onDownloadReport?: (report: MedicalReport) => void
  onOpenReportFolder?: (report: MedicalReport) => void
  isDownloading?: boolean
  isLocallyDownloaded?: boolean
}

export const MedicalReportPreviewModal: React.FC<MedicalReportPreviewModalProps> = ({
  visible,
  report,
  onClose,
  onDownloadReport,
  onOpenReportFolder,
  isDownloading,
  isLocallyDownloaded,
}) => {
  const [activeUrlIndex, setActiveUrlIndex] = useState(0)
  const [imageScale, setImageScale] = useState(1)
  const [imageRotation, setImageRotation] = useState(0)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

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

  // 键盘快捷键拦截（屏蔽 Ctrl+S 保存与 Ctrl+P 打印，同时支持左右方向键快捷翻页切换附件）
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault()
        e.stopPropagation()
      } else if (e.key === 'ArrowLeft') {
        setActiveUrlIndex(prev => {
          if (prev > 0) {
            setImageScale(1)
            setImageRotation(0)
            return prev - 1
          }
          return prev
        })
      } else if (e.key === 'ArrowRight') {
        setActiveUrlIndex(prev => {
          if (prev < fileUrls.length - 1) {
            setImageScale(1)
            setImageRotation(0)
            return prev + 1
          }
          return prev
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [visible, fileUrls.length])

  // 当选中的附件变更时，自动平滑横向滚动，确保高亮项居中可见（支持 19+ 份超多附件）
  useEffect(() => {
    if (itemRefs.current[activeUrlIndex]) {
      itemRefs.current[activeUrlIndex]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [activeUrlIndex])

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

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <FileProtectOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              体检报告在线预览
            </span>
            <span style={{ color: '#666', fontSize: 14 }}>
              - {report?.reportName || report?.alias || '体检报告原件'}
            </span>
            {getReportTypeTag(report?.reportType)}
            <Tag color="cyan" icon={<SafetyCertificateOutlined />}>
              纯内存安全阅览 · 动态防拍照水印
            </Tag>
          </Space>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1020}
      style={{ top: 16 }}
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
          <Space size="middle">
            <Space size="small">
              <LockOutlined style={{ color: '#52c41a' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                已添加防拍照溯源盲水印。查阅完毕关闭窗口即释放内存。
              </Text>
            </Space>

            {report && onDownloadReport && (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={isDownloading}
                onClick={() => onDownloadReport(report)}
              >
                {isLocallyDownloaded ? '重新归档至电脑' : '下载归档至电脑'}
              </Button>
            )}

            {report && isLocallyDownloaded && onOpenReportFolder && (
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={() => onOpenReportFolder(report)}
              >
                打开本地归档目录
              </Button>
            )}
          </Space>

          <Button type="primary" icon={<CloseOutlined />} onClick={onClose}>
            完成查阅并关闭
          </Button>
        </div>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '76vh' }}>
        {/* 多附件切换导航栏（解决19+超多附件溢出，支持平滑横向滚动、左右按键翻页与下拉直达） */}
        {fileUrls.length > 1 && (
          <div
            style={{
              padding: '6px 12px',
              background: '#fff',
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            {/* 左侧：翻页与快速跳转 */}
            <Space size={4} style={{ flexShrink: 0 }}>
              <Tooltip title="上一份附件 (或按键盘 ← 键)">
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={activeUrlIndex === 0}
                  onClick={() => {
                    setActiveUrlIndex(prev => Math.max(0, prev - 1))
                    setImageScale(1)
                    setImageRotation(0)
                  }}
                />
              </Tooltip>
              <Select
                size="small"
                value={activeUrlIndex}
                style={{ width: 145 }}
                onChange={val => {
                  setActiveUrlIndex(val)
                  setImageScale(1)
                  setImageRotation(0)
                }}
                options={fileUrls.map((url, idx) => {
                  const ext = url.split('?')[0].split('.').pop()?.toUpperCase() || '文件'
                  return {
                    value: idx,
                    label: `第 ${idx + 1}/${fileUrls.length} 份 (${ext})`,
                  }
                })}
              />
              <Tooltip title="下一份附件 (或按键盘 → 键)">
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  disabled={activeUrlIndex >= fileUrls.length - 1}
                  onClick={() => {
                    setActiveUrlIndex(prev => Math.min(fileUrls.length - 1, prev + 1))
                    setImageScale(1)
                    setImageRotation(0)
                  }}
                />
              </Tooltip>
            </Space>

            {/* 中间：横向滚动附件药丸按钮列表（自适应 19+ 份超长附件列表） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                overflowY: 'hidden',
                flex: 1,
                minWidth: 0,
                padding: '2px 0',
                scrollbarWidth: 'thin',
              }}
            >
              {fileUrls.map((url, idx) => {
                const clean = url.split('?')[0]
                const ext = clean.split('.').pop()?.toUpperCase() || '文件'
                const isPdf = ext === 'PDF'
                const isActive = idx === activeUrlIndex

                return (
                  <Button
                    key={idx}
                    ref={el => {
                      itemRefs.current[idx] = el
                    }}
                    size="small"
                    type={isActive ? 'primary' : 'default'}
                    icon={
                      isPdf ? (
                        <FilePdfOutlined style={{ color: isActive ? '#fff' : '#ff4d4f' }} />
                      ) : (
                        <FileImageOutlined style={{ color: isActive ? '#fff' : '#1890ff' }} />
                      )
                    }
                    onClick={() => {
                      setActiveUrlIndex(idx)
                      setImageScale(1)
                      setImageRotation(0)
                    }}
                    style={{
                      flexShrink: 0,
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 12,
                      borderRadius: 14,
                    }}
                  >
                    附件 {idx + 1} ({ext})
                  </Button>
                )
              })}
            </div>

            {/* 右侧：统计标签 */}
            <Tag color="blue" style={{ flexShrink: 0, margin: 0 }}>
              共 {fileUrls.length} 份
            </Tag>
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
              // 1. PDF 报告：通过 Mozilla PDF.js 内存解析渲染，无任何跨域或 WebView2 iframe 限制
              <div style={{ height: '100%', width: '100%', background: '#525659' }}>
                <PdfViewer
                  fileUrl={activeUrl}
                  watermarkText={watermarkText}
                  height="100%"
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
