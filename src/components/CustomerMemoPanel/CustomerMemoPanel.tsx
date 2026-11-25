import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Image, Input, Popconfirm, Space, Spin, Typography, message } from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  PictureOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { format } from 'date-fns'
import type { CustomerMemoImage, CustomerRecord } from '@/types'
import { CustomerMemoService } from '@/services/customerMemoService'
import { formatFileSize } from '@/utils/compression'
import './CustomerMemoPanel.css'

const { Paragraph, Text } = Typography

interface CustomerMemoPanelProps {
  customer: CustomerRecord
}

/** HEIC 也列出来，这样医生选中后会看到“请改用微信图片方式发送”的提示，而不是在选择框里根本找不到 */
const FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/bmp,image/gif,.heic,.heif'
const IMAGE_NAME_PATTERN = /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i

type ImageKind = 'thumb' | 'original'

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function formatTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd HH:mm')
}

/** 从拖进来的文件里挑出照片；其他文件（文档、压缩包等）不处理 */
function pickImageFiles(files: FileList | File[] | null | undefined): File[] {
  if (!files) return []
  return Array.from(files).filter(
    file => file.type.startsWith('image/') || IMAGE_NAME_PATTERN.test(file.name)
  )
}

/** 元素是否真的显示在页面上。便签页被切走后 antd 用 display:none 隐藏，这时不应响应粘贴 */
function isShown(element: HTMLElement): boolean {
  for (
    let node: HTMLElement | null = element;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (node.hidden || window.getComputedStyle(node).display === 'none') {
      return false
    }
  }
  return true
}

function urlKey(imageId: string, kind: ImageKind): string {
  return `${imageId}:${kind}`
}

/**
 * 客户随访便签面板：上半部分是文本便签，下半部分是历史纸质记录的照片。
 * 文本与照片都只保存在本机。
 */
export const CustomerMemoPanel: React.FC<CustomerMemoPanelProps> = ({ customer }) => {
  const memoService = CustomerMemoService.getInstance()

  // 便签以“系统档案编号”归属到客户
  const customerId = String(customer.id ?? customer.customerId ?? '').trim()
  const canUseMemo = customerId !== '' && customerId !== 'undefined' && customerId !== 'null'
  const imageSupported = useMemo(() => memoService.isImageSupported(), [memoService])

  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [images, setImages] = useState<CustomerMemoImage[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [unavailableImages, setUnavailableImages] = useState<Record<string, boolean>>({})
  const [storageRootPath, setStorageRootPath] = useState('')
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [addProgress, setAddProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState({ open: false, current: 0 })

  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const addingRef = useRef(false)
  const requestedThumbsRef = useRef(new Set<string>())

  // 打开便签时读取文本与照片列表
  useEffect(() => {
    requestedThumbsRef.current.clear()
    if (!canUseMemo) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setContent('')
    setSavedContent('')
    setUpdatedAt(null)
    setImages([])
    setImageUrls({})
    setUnavailableImages({})
    memoService
      .getMemo(customerId)
      .then(data => {
        if (cancelled) return
        setContent(data.content)
        setSavedContent(data.content)
        setUpdatedAt(data.updatedAt)
        setImages(data.images)
        setStorageRootPath(data.storageRootPath)
        setStorageAvailable(data.storageAvailable)
      })
      .catch(err => {
        if (!cancelled) message.error(`读取随访便签失败: ${describeError(err)}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [memoService, customerId, canUseMemo])

  // 关闭便签（或切换客户）时释放照片占用的内存
  useEffect(() => {
    return () => memoService.releaseImageUrls()
  }, [memoService, customerId])

  // 缩略图在后台逐张读取，读到一张显示一张
  useEffect(() => {
    images.forEach(image => {
      if (requestedThumbsRef.current.has(image.id)) return
      requestedThumbsRef.current.add(image.id)
      memoService
        .getImageUrl(image, 'thumb')
        .then(url => setImageUrls(prev => ({ ...prev, [urlKey(image.id, 'thumb')]: url })))
        .catch(() => setUnavailableImages(prev => ({ ...prev, [image.id]: true })))
    })
  }, [memoService, images])

  // 拖着文件时如果没对准便签区域就松手，浏览器会直接打开这个文件并顶掉整个应用界面，这里统一拦掉。
  // 只拦截拖着文件的拖放，不影响在输入框里拖动选中文字。
  useEffect(() => {
    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const preventOpeningDroppedFile = (event: DragEvent) => {
      if (isFileDrag(event)) event.preventDefault()
    }
    window.addEventListener('dragover', preventOpeningDroppedFile)
    window.addEventListener('drop', preventOpeningDroppedFile)
    return () => {
      window.removeEventListener('dragover', preventOpeningDroppedFile)
      window.removeEventListener('drop', preventOpeningDroppedFile)
    }
  }, [])

  const addImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      if (addingRef.current) {
        message.info('正在保存上一批照片，请稍候再试')
        return
      }
      addingRef.current = true
      setAddProgress({ done: 0, total: files.length })
      try {
        const result = await memoService.addImages(customerId, files, (done, total) =>
          setAddProgress({ done, total })
        )
        if (result.added.length > 0) {
          setImages(prev => [...prev, ...result.added])
          message.success(`已保存 ${result.added.length} 张照片`)
        }
        if (result.failed.length > 0) {
          const reasons = result.failed.map(item => `${item.fileName}（${item.reason}）`).join('；')
          message.warning(
            <span style={{ maxWidth: 420, whiteSpace: 'normal' }}>
              {result.failed.length} 张照片未能添加：{reasons}
            </span>
          )
        }
      } catch (err) {
        message.error(`添加照片失败: ${describeError(err)}`)
      } finally {
        addingRef.current = false
        setAddProgress(null)
      }
    },
    [memoService, customerId]
  )

  // 在微信里复制照片后，直接在便签上按 Ctrl+V 即可加入
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? [])
      const files = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null)
      if (files.length === 0) return

      const root = rootRef.current
      if (!root || !isShown(root)) return
      // 焦点在弹出的窗口（比如照片预览）里时不处理，避免误加
      const active = document.activeElement
      if (active !== document.body && !root.contains(active)) return

      event.preventDefault()
      void addImages(files)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [addImages])

  const handleSaveContent = async () => {
    setSaving(true)
    try {
      await memoService.saveContent(customerId, content)
      setSavedContent(content)
      setUpdatedAt(new Date().toISOString())
      message.success('医生随访便签保存成功')
    } catch (err) {
      message.error(`便签保存失败: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const openFilePicker = () => fileInputRef.current?.click()

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    // 清空选择，这样下次选同一个文件也会触发
    event.target.value = ''
    if (files.length === 0) return
    const photos = pickImageFiles(files)
    if (photos.length === 0) {
      message.info('请选择照片文件（JPG、PNG、WebP）')
      return
    }
    void addImages(photos)
  }

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files')

  const handleDragEnter = (event: React.DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    // 进入、离开子元素都会触发事件，用计数判断是否真的离开了便签区域
    dragDepthRef.current += 1
    setDragging(true)
  }

  const handleDragOver = (event: React.DragEvent) => {
    if (hasFiles(event)) event.preventDefault()
  }

  const handleDragLeave = (event: React.DragEvent) => {
    if (!hasFiles(event)) return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepthRef.current = 0
    setDragging(false)
    const files = pickImageFiles(event.dataTransfer.files)
    if (files.length === 0) {
      message.info('请拖入照片文件（JPG、PNG、WebP）')
      return
    }
    void addImages(files)
  }

  const handleOpenFolder = () => {
    memoService.openFolder(customerId).catch(err =>
      message.error(`打开照片目录失败: ${describeError(err)}`)
    )
  }

  const loadOriginal = (image: CustomerMemoImage) =>
    memoService
      .getImageUrl(image, 'original')
      .then(url => setImageUrls(prev => ({ ...prev, [urlKey(image.id, 'original')]: url })))
      .catch(() => setUnavailableImages(prev => ({ ...prev, [image.id]: true })))

  const openPreview = async (index: number) => {
    const image = images[index]
    if (!image) return
    if (unavailableImages[image.id]) {
      message.error('这张照片的文件已经找不到，无法放大查看')
      return
    }
    try {
      // 先读到原图再打开，避免一打开是模糊的缩略图
      const url = await memoService.getImageUrl(image, 'original')
      setImageUrls(prev => ({ ...prev, [urlKey(image.id, 'original')]: url }))
    } catch (err) {
      setUnavailableImages(prev => ({ ...prev, [image.id]: true }))
      message.error(`打开照片失败: ${describeError(err)}`)
      return
    }
    setPreview({ open: true, current: index })
  }

  const handlePreviewChange = (current: number) => {
    setPreview(prev => ({ ...prev, current }))
    // 翻到还没读过原图的照片时先显示缩略图，原图读到后自动换成清晰的
    const image = images[current]
    if (image && !unavailableImages[image.id]) {
      void loadOriginal(image)
    }
  }

  const handleDeleteImage = async (image: CustomerMemoImage) => {
    try {
      await memoService.deleteImage(customerId, image.id)
      setImages(prev => prev.filter(item => item.id !== image.id))
      setImageUrls(prev => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${image.id}:`)) delete next[key]
        }
        return next
      })
      setPreview({ open: false, current: 0 })
      message.success('照片已删除')
    } catch (err) {
      message.error(`删除照片失败: ${describeError(err)}`)
    }
  }

  // 预览列表：有原图用原图，没有的先用缩略图占位
  const previewItems = useMemo(
    () =>
      images.map(image => ({
        src: imageUrls[urlKey(image.id, 'original')] ?? imageUrls[urlKey(image.id, 'thumb')] ?? '',
      })),
    [images, imageUrls]
  )

  if (!canUseMemo) {
    return (
      <Alert
        type="warning"
        showIcon
        message="当前客户缺少系统档案编号，无法使用随访便签"
      />
    )
  }

  const dirty = content !== savedContent
  const savedTime = formatTime(updatedAt)
  const isAdding = addProgress !== null
  const totalBytes = images.reduce((sum, image) => sum + (image.fileSize || 0), 0)
  const shownDone = Math.min((addProgress?.done ?? 0) + 1, addProgress?.total ?? 0)

  return (
    <div
      ref={rootRef}
      className={dragging ? 'memo-panel memo-panel--dragging' : 'memo-panel'}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="memo-panel__drop-overlay">松开鼠标，照片就会加入这位客户的便签</div>
      )}

      <Spin spinning={loading}>
        <Card
          size="small"
          bordered={false}
          title="医生工作随手记 (替代纸质本)"
          style={{ marginBottom: 12 }}
        >
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            随时记录与客户沟通的健康指标变化、个性化饮食方案或复查提醒。
          </Paragraph>
          <Input.TextArea
            rows={6}
            disabled={loading}
            placeholder="输入该客户的随访要点、用药禁忌或预约备忘..."
            value={content}
            onChange={event => setContent(event.target.value)}
          />
          <div className="memo-panel__save-row">
            <span className="memo-panel__save-state">
              {dirty
                ? '有修改还没保存'
                : savedTime
                  ? `已保存 · ${savedTime}`
                  : '便签保存在这台电脑上'}
            </span>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={loading}
              onClick={handleSaveContent}
            >
              保存便签
            </Button>
          </div>
        </Card>

        {imageSupported && (
          <Card
            size="small"
            bordered={false}
            title="历史纸质记录照片"
            extra={
              <Space size={4}>
                {images.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    共 {images.length} 张 · 约 {formatFileSize(totalBytes)}
                  </Text>
                )}
                {storageRootPath && (
                  <Button
                    type="link"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={handleOpenFolder}
                  >
                    打开目录
                  </Button>
                )}
              </Space>
            }
          >
            {!storageAvailable && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message="便签照片库所在的磁盘现在不可用，暂时无法查看或添加照片"
                description={`照片库位置：${storageRootPath}`}
              />
            )}

            <button
              type="button"
              className="memo-panel__add"
              onClick={openFilePicker}
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <LoadingOutlined /> 正在保存照片 ({shownDone}/{addProgress?.total})…
                </>
              ) : (
                <>
                  <PlusOutlined /> 添加照片
                </>
              )}
            </button>
            <Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 12px' }}>
              点击上方按钮选择照片，或者把微信聊天里的照片直接拖到这块区域；也可以先在微信里复制照片，再在这里按
              Ctrl+V 粘贴。照片加入后立即保存到本机，不需要再点“保存便签”。
            </Paragraph>

            {images.length > 0 && (
              <div className="memo-panel__gallery">
                {images.map((image, index) => {
                  const thumbUrl = imageUrls[urlKey(image.id, 'thumb')]
                  const label = `照片 ${index + 1}`
                  const addedTime = formatTime(image.createdAt)
                  return (
                    <div
                      key={image.id}
                      className="memo-panel__tile"
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      title={addedTime ? `${image.fileName || label}（${addedTime} 添加）` : image.fileName || label}
                      onClick={event => {
                        // 删除确认框显示在页面根部，点它时事件会冒泡到这里，需要排除
                        if (!event.currentTarget.contains(event.target as Node)) return
                        void openPreview(index)
                      }}
                      onKeyDown={event => {
                        if (
                          (event.key === 'Enter' || event.key === ' ') &&
                          event.target === event.currentTarget
                        ) {
                          event.preventDefault()
                          void openPreview(index)
                        }
                      }}
                    >
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={label} draggable={false} />
                      ) : (
                        <div className="memo-panel__tile-missing">
                          <PictureOutlined />
                          {unavailableImages[image.id] ? '文件丢失' : '读取中'}
                        </div>
                      )}
                      <div className="memo-panel__tile-zoom">
                        <EyeOutlined /> 放大查看
                      </div>
                      <Popconfirm
                        title="删除这张照片？"
                        description="删除后这张照片不再显示。"
                        okText="确认删除"
                        cancelText="取消"
                        trigger="click"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => void handleDeleteImage(image)}
                      >
                        <button
                          type="button"
                          className="memo-panel__tile-delete"
                          aria-label="删除这张照片"
                          title="删除"
                          onClick={event => event.stopPropagation()}
                        >
                          <DeleteOutlined />
                        </button>
                      </Popconfirm>
                    </div>
                  )
                })}
              </div>
            )}

            {storageRootPath && (
              <div className="memo-panel__location">照片保存在：{storageRootPath}</div>
            )}
          </Card>
        )}
      </Spin>

      {images.length > 0 && (
        <Image.PreviewGroup
          items={previewItems}
          preview={{
            visible: preview.open,
            current: preview.current,
            onVisibleChange: open =>
              setPreview(prev => (prev.open === open ? prev : { ...prev, open })),
            onChange: handlePreviewChange,
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        hidden
        onChange={handleFileInputChange}
      />
    </div>
  )
}
