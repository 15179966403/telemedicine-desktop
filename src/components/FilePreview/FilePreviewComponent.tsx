import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Button,
  Spin,
  message,
  Image,
  Typography,
  Space,
  Divider,
} from 'antd'
import {
  DownloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  FullscreenOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { FileInfo, FilePreviewInfo } from '../../types/file'
import { FileService } from '../../services/fileService'
import { FileStorageService } from '../../services/fileStorageService'
import './FilePreviewComponent.css'

const { Text, Title } = Typography

export interface FilePreviewComponentProps {
  fileInfo: FileInfo | null
  visible: boolean
  onClose: () => void
  onDownload?: (fileInfo: FileInfo) => void
}

interface PreviewState {
  loading: boolean
  error: string | null
  previewUrl: string | null
  canPreview: boolean
  zoom: number
  rotation: number
}

export const FilePreviewComponent: React.FC<FilePreviewComponentProps> = ({
  fileInfo,
  visible,
  onClose,
  onDownload,
}) => {
  const [previewState, setPreviewState] = useState<PreviewState>({
    loading: false,
    error: null,
    previewUrl: null,
    canPreview: false,
    zoom: 100,
    rotation: 0,
  })

  const fileService = FileService.getInstance()
  const storageService = FileStorageService.getInstance()

  // 重置预览状态
  const resetPreviewState = useCallback(() => {
    setPreviewState({
      loading: false,
      error: null,
      previewUrl: null,
      canPreview: false,
      zoom: 100,
      rotation: 0,
    })
  }, [])

  // 检查文件是否可预览
  const checkPreviewability = useCallback((file: FileInfo): boolean => {
    const previewableTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'text/plain',
      'application/pdf',
    ]

    return previewableTypes.includes(file.type)
  }, [])

  // 加载预览内容
  const loadPreview = useCallback(
    async (file: FileInfo) => {
      if (!checkPreviewability(file)) {
        setPreviewState(prev => ({
          ...prev,
          canPreview: false,
          error: '该文件类型不支持预览',
        }))
        return
      }

      setPreviewState(prev => ({
        ...prev,
        loading: true,
        error: null,
        canPreview: true,
      }))

      try {
        let previewUrl = file.url

        // 如果文件在本地缓存中，使用本地路径
        if (file.localPath) {
          const isInCache = await storageService.isFileInCache(file.url)
          if (isInCache) {
            // 对于本地文件，需要转换为可预览的URL
            previewUrl = await generateLocalPreviewUrl(
              file.localPath,
              file.type
            )
          }
        }

        setPreviewState(prev => ({
          ...prev,
          loading: false,
          previewUrl,
        }))
      } catch (error) {
        console.error('Load preview failed:', error)
        setPreviewState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '预览加载失败',
        }))
      }
    },
    [checkPreviewability, storageService]
  )

  // 生成本地文件预览URL
  const generateLocalPreviewUrl = async (
    localPath: string,
    fileType: string
  ): Promise<string> => {
    try {
      // 对于图片文件，可以直接使用本地路径
      if (fileType.startsWith('image/')) {
        return `file://${localPath}`
      }

      // 对于其他文件类型，可能需要特殊处理
      // 这里简化处理，实际项目中可能需要更复杂的逻辑
      return `file://${localPath}`
    } catch (error) {
      throw new Error('生成本地预览URL失败')
    }
  }

  // 处理下载
  const handleDownload = useCallback(async () => {
    if (!fileInfo) return

    try {
      if (onDownload) {
        onDownload(fileInfo)
      } else {
        await fileService.downloadFile(fileInfo.url, fileInfo.name)
        message.success('文件下载成功')
      }
    } catch (error) {
      message.error('文件下载失败')
    }
  }, [fileInfo, fileService, onDownload])

  // 缩放控制
  const handleZoom = useCallback((delta: number) => {
    setPreviewState(prev => ({
      ...prev,
      zoom: Math.max(25, Math.min(400, prev.zoom + delta)),
    }))
  }, [])

  // 旋转控制
  const handleRotate = useCallback((delta: number) => {
    setPreviewState(prev => ({
      ...prev,
      rotation: (prev.rotation + delta) % 360,
    }))
  }, [])

  // 全屏预览
  const handleFullscreen = useCallback(() => {
    if (!previewState.previewUrl) return

    // 创建全屏预览窗口
    const fullscreenWindow = window.open('', '_blank', 'fullscreen=yes')
    if (fullscreenWindow) {
      fullscreenWindow.document.write(`
        <html>
          <head>
            <title>文件预览 - ${fileInfo?.name}</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${previewState.previewUrl}" alt="${fileInfo?.name}" />
          </body>
        </html>
      `)
    }
  }, [previewState.previewUrl, fileInfo?.name])

  // 当文件信息变化时加载预览
  useEffect(() => {
    if (visible && fileInfo) {
      loadPreview(fileInfo)
    } else {
      resetPreviewState()
    }
  }, [visible, fileInfo, loadPreview, resetPreviewState])

  // 渲染预览内容
  const renderPreviewContent = () => {
    if (previewState.loading) {
      return (
        <div className="preview-loading">
          <Spin size="large" />
          <Text style={{ marginTop: 16, display: 'block' }}>加载预览中...</Text>
        </div>
      )
    }

    if (previewState.error) {
      return (
        <div className="preview-error">
          <Text type="danger">{previewState.error}</Text>
        </div>
      )
    }

    if (!previewState.canPreview || !previewState.previewUrl) {
      return (
        <div className="preview-not-supported">
          <div className="file-icon">
            {fileService.getFileIcon(fileInfo?.type || '')}
          </div>
          <Title level={4}>{fileInfo?.name}</Title>
          <Space direction="vertical" size="small">
            <Text>
              文件大小:{' '}
              {fileInfo ? fileService.formatFileSize(fileInfo.size) : ''}
            </Text>
            <Text>文件类型: {fileInfo?.type}</Text>
            <Text>上传时间: {fileInfo?.uploadedAt.toLocaleString()}</Text>
          </Space>
          <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
            该文件类型不支持在线预览，请下载后查看
          </Text>
        </div>
      )
    }

    // 根据文件类型渲染不同的预览内容
    if (fileInfo?.type.startsWith('image/')) {
      return (
        <div className="image-preview">
          <div className="image-controls">
            <Space>
              <Button
                icon={<ZoomOutOutlined />}
                onClick={() => handleZoom(-25)}
                disabled={previewState.zoom <= 25}
              >
                缩小
              </Button>
              <Text>{previewState.zoom}%</Text>
              <Button
                icon={<ZoomInOutlined />}
                onClick={() => handleZoom(25)}
                disabled={previewState.zoom >= 400}
              >
                放大
              </Button>
              <Divider type="vertical" />
              <Button
                icon={<RotateLeftOutlined />}
                onClick={() => handleRotate(-90)}
              >
                左转
              </Button>
              <Button
                icon={<RotateRightOutlined />}
                onClick={() => handleRotate(90)}
              >
                右转
              </Button>
              <Button icon={<FullscreenOutlined />} onClick={handleFullscreen}>
                全屏
              </Button>
            </Space>
          </div>
          <div className="image-container">
            <Image
              src={previewState.previewUrl}
              alt={fileInfo.name}
              style={{
                transform: `scale(${previewState.zoom / 100}) rotate(${previewState.rotation}deg)`,
                transition: 'transform 0.3s ease',
              }}
              preview={false}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
            />
          </div>
        </div>
      )
    }

    if (fileInfo?.type === 'text/plain') {
      return (
        <div className="text-preview">
          <iframe
            src={previewState.previewUrl}
            style={{ width: '100%', height: '500px', border: 'none' }}
            title={fileInfo.name}
          />
        </div>
      )
    }

    if (fileInfo?.type === 'application/pdf') {
      return (
        <div className="pdf-preview">
          <iframe
            src={previewState.previewUrl}
            style={{ width: '100%', height: '600px', border: 'none' }}
            title={fileInfo.name}
          />
        </div>
      )
    }

    return null
  }

  return (
    <Modal
      title={
        <Space>
          <span>文件预览</span>
          {fileInfo && <Text type="secondary">- {fileInfo.name}</Text>}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      style={{ top: 20 }}
      footer={[
        <Button
          key="download"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
        >
          下载
        </Button>,
        <Button key="close" icon={<CloseOutlined />} onClick={onClose}>
          关闭
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="file-preview-component">{renderPreviewContent()}</div>
    </Modal>
  )
}
