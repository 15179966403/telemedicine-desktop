import React, { useState, useRef, useCallback } from 'react'
import {
  Upload,
  Button,
  Progress,
  message,
  Modal,
  List,
  Typography,
} from 'antd'
import {
  InboxOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import { FileService } from '../../services/fileService'
import { FileInfo } from '../../types/file'
import './FileUploadComponent.css'

const { Dragger } = Upload
const { Text } = Typography

export interface FileUploadComponentProps {
  consultationId?: string
  maxFiles?: number
  maxFileSize?: number // MB
  allowedTypes?: string[]
  onFileUploaded?: (fileInfo: FileInfo) => void
  onFileDeleted?: (fileId: string) => void
  disabled?: boolean
}

interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  consultationId,
  maxFiles = 10,
  maxFileSize = 50,
  allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.txt'],
  onFileUploaded,
  onFileDeleted,
  disabled = false,
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null)
  const fileService = FileService.getInstance()
  const uploadRef = useRef<any>(null)

  // 文件上传前的验证
  const beforeUpload = useCallback(
    (file: File): boolean => {
      // 检查文件数量限制
      if (uploadedFiles.length + uploadingFiles.length >= maxFiles) {
        message.error(`最多只能上传 ${maxFiles} 个文件`)
        return false
      }

      // 检查文件大小
      const fileSizeMB = file.size / 1024 / 1024
      if (fileSizeMB > maxFileSize) {
        message.error(`文件大小不能超过 ${maxFileSize}MB`)
        return false
      }

      // 检查文件类型
      const isValidType = allowedTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0]
          return file.type.startsWith(baseType)
        }
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase())
        }
        return file.type === type
      })

      if (!isValidType) {
        message.error('不支持的文件类型')
        return false
      }

      return true
    },
    [
      uploadedFiles.length,
      uploadingFiles.length,
      maxFiles,
      maxFileSize,
      allowedTypes,
    ]
  )

  // 处理文件上传
  const handleUpload = useCallback(
    async (file: File) => {
      const uploadingFile: UploadingFile = {
        id: `uploading-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: 'uploading',
      }

      setUploadingFiles(prev => [...prev, uploadingFile])

      try {
        // 上传文件并监听进度
        const fileInfo = await fileService.uploadFile(file, progress => {
          setUploadingFiles(prev =>
            prev.map(f => (f.id === uploadingFile.id ? { ...f, progress } : f))
          )
        })

        // 上传成功
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadingFile.id))
        setUploadedFiles(prev => [...prev, fileInfo])
        onFileUploaded?.(fileInfo)
        message.success(`${file.name} 上传成功`)
      } catch (error) {
        // 上传失败
        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : '上传失败',
                }
              : f
          )
        )
        message.error(
          `${file.name} 上传失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
      }
    },
    [fileService, onFileUploaded]
  )

  // 自定义上传逻辑
  const customRequest: UploadProps['customRequest'] = ({
    file,
    onSuccess,
    onError,
  }) => {
    if (file instanceof File) {
      handleUpload(file)
        .then(() => onSuccess?.('ok'))
        .catch(error => onError?.(error))
    }
  }

  // 删除文件
  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await fileService.deleteFile(fileId)
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
        onFileDeleted?.(fileId)
        message.success('文件删除成功')
      } catch (error) {
        message.error('文件删除失败')
      }
    },
    [fileService, onFileDeleted]
  )

  // 重试上传
  const handleRetryUpload = useCallback(
    (uploadingFileId: string) => {
      const uploadingFile = uploadingFiles.find(f => f.id === uploadingFileId)
      if (uploadingFile) {
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadingFileId))
        handleUpload(uploadingFile.file)
      }
    },
    [uploadingFiles, handleUpload]
  )

  // 预览文件
  const handlePreviewFile = useCallback((fileInfo: FileInfo) => {
    setPreviewFile(fileInfo)
    setPreviewVisible(true)
  }, [])

  // 下载文件
  const handleDownloadFile = useCallback(
    async (fileInfo: FileInfo) => {
      try {
        const localPath = await fileService.downloadFile(
          fileInfo.url,
          fileInfo.name
        )
        message.success(`文件已下载到: ${localPath}`)
      } catch (error) {
        message.error('文件下载失败')
      }
    },
    [fileService]
  )

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: allowedTypes.join(','),
    beforeUpload,
    customRequest,
    showUploadList: false,
    disabled,
  }

  return (
    <div className="file-upload-component">
      {/* 文件上传区域 */}
      <Dragger {...uploadProps} className="upload-dragger">
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持单个或批量上传，最多 {maxFiles} 个文件，单个文件不超过{' '}
          {maxFileSize}MB
        </p>
      </Dragger>

      {/* 上传中的文件列表 */}
      {uploadingFiles.length > 0 && (
        <div className="uploading-files">
          <h4>上传中</h4>
          <List
            dataSource={uploadingFiles}
            renderItem={item => (
              <List.Item
                actions={[
                  item.status === 'error' && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleRetryUpload(item.id)}
                    >
                      重试
                    </Button>
                  ),
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() =>
                      setUploadingFiles(prev =>
                        prev.filter(f => f.id !== item.id)
                      )
                    }
                  >
                    取消
                  </Button>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={item.file.name}
                  description={
                    <div>
                      <div>
                        大小: {fileService.formatFileSize(item.file.size)}
                      </div>
                      {item.status === 'uploading' && (
                        <Progress percent={item.progress} size="small" />
                      )}
                      {item.status === 'error' && (
                        <Text type="danger">{item.error}</Text>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 已上传的文件列表 */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <h4>已上传文件</h4>
          <List
            dataSource={uploadedFiles}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreviewFile(item)}
                  >
                    预览
                  </Button>,
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownloadFile(item)}
                  >
                    下载
                  </Button>,
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteFile(item.id)}
                  >
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <span style={{ fontSize: '24px' }}>
                      {fileService.getFileIcon(item.type)}
                    </span>
                  }
                  title={item.name}
                  description={
                    <div>
                      <div>大小: {fileService.formatFileSize(item.size)}</div>
                      <div>上传时间: {item.uploadedAt.toLocaleString()}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 文件预览模态框 */}
      <Modal
        title="文件预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button
            key="download"
            onClick={() => previewFile && handleDownloadFile(previewFile)}
          >
            下载
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {previewFile && (
          <div className="file-preview">
            {previewFile.type.startsWith('image/') ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                style={{ maxWidth: '100%', maxHeight: '500px' }}
              />
            ) : (
              <div className="file-info">
                <div
                  style={{
                    fontSize: '48px',
                    textAlign: 'center',
                    marginBottom: '16px',
                  }}
                >
                  {fileService.getFileIcon(previewFile.type)}
                </div>
                <p>
                  <strong>文件名:</strong> {previewFile.name}
                </p>
                <p>
                  <strong>文件大小:</strong>{' '}
                  {fileService.formatFileSize(previewFile.size)}
                </p>
                <p>
                  <strong>文件类型:</strong> {previewFile.type}
                </p>
                <p>
                  <strong>上传时间:</strong>{' '}
                  {previewFile.uploadedAt.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
