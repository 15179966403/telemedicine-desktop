import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Spin,
  Button,
  Space,
  Tooltip,
  Tag,
  Alert,
  Watermark,
} from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateRightOutlined,
  ReloadOutlined,
  ColumnWidthOutlined,
  FilePdfOutlined,
} from '@ant-design/icons'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ReportFileService } from '@/services/reportFileService'

// 配置本地 PDF.js Worker 路径（优先使用 Vite 打包 URL，兜底使用 public 静态资源）
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl || '/pdfjs/pdf.worker.min.mjs'
}

export interface PdfViewerProps {
  /** PDF 远程 URL 或本地绝对路径 */
  fileUrl?: string
  /** 外部直接提供的 PDF 二进制数据 */
  fileData?: Uint8Array | null
  /** 合规水印文字（支持多行数组） */
  watermarkText?: string | string[]
  /** 容器自定义高度 */
  height?: string | number
  /** 类名 */
  className?: string
  /** 样式 */
  style?: React.CSSProperties
}

interface PageItemProps {
  pdfDoc: PDFDocumentProxy
  pageNum: number
  scale: number
  rotation: number
}

// 单页渲染子组件（支持的高清 DPR 适配与渲染任务取消）
const PdfPageItem: React.FC<PageItemProps> = ({
  pdfDoc,
  pageNum,
  scale,
  rotation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const renderTaskRef = useRef<any>(null)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const renderPage = async () => {
      try {
        setPageLoading(true)
        const page: PDFPageProxy = await pdfDoc.getPage(pageNum)
        if (isCancelled || !canvasRef.current) return

        const canvas = canvasRef.current
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return

        // 结合当前旋转角度与缩放倍率生成视口
        const effectiveRotation = (page.rotate + rotation) % 360
        const viewport = page.getViewport({ scale, rotation: effectiveRotation })

        // 高清屏支持：按照 devicePixelRatio 缩放 canvas 画布尺寸
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.scale(dpr, dpr)

        // 如果存在上一次未完成的渲染任务，先取消
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // ignore
          }
        }

        const renderContext = {
          canvasContext: context,
          viewport,
        }

        const task = page.render(renderContext)
        renderTaskRef.current = task

        await task.promise
        if (!isCancelled) {
          setPageLoading(false)
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Render page ${pageNum} error:`, err)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [pdfDoc, pageNum, scale, rotation])

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 16,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        borderRadius: 4,
        overflow: 'hidden',
        background: '#fff',
        display: 'inline-block',
      }}
    >
      {pageLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <Spin size="small" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 10,
          background: 'rgba(0, 0, 0, 0.45)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 10,
          fontSize: 11,
          pointerEvents: 'none',
        }}
      >
        第 {pageNum} 页
      </div>
    </div>
  )
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  fileUrl,
  fileData,
  watermarkText,
  height = '100%',
  className,
  style,
}) => {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.15)
  const [rotation, setRotation] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const reportFileService = ReportFileService.getInstance()

  // 加载 PDF 数据并解析
  const loadPdf = useCallback(async () => {
    if (!fileUrl && !fileData) {
      setPdfDoc(null)
      setNumPages(0)
      return
    }

    try {
      setLoading(true)
      setErrorMsg(null)

      let bytes: Uint8Array
      if (fileData) {
        bytes = fileData
      } else if (fileUrl) {
        // 调用后端 Tauri 命令获取字节，彻底规避跨域与 WebView2 iframe 限制
        bytes = await reportFileService.getPdfFileBytes(fileUrl)
      } else {
        return
      }

      if (!bytes || bytes.length === 0) {
        throw new Error('未获取到有效的 PDF 数据流')
      }

      // 创建 PDF.js 加载任务，配置中文字体映射表路径
      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      })

      const doc = await loadingTask.promise
      setPdfDoc(doc)
      setNumPages(doc.numPages)
    } catch (err: any) {
      console.error('PDF 加载解析失败:', err)
      setErrorMsg(err?.message || 'PDF 解析失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [fileUrl, fileData])

  useEffect(() => {
    loadPdf()
  }, [loadPdf])

  // 缩放操作
  const handleZoomIn = () => {
    setScale(prev => Math.min(Number((prev + 0.15).toFixed(2)), 3.0))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(Number((prev - 0.15).toFixed(2)), 0.5))
  }

  const handleResetZoom = () => {
    setScale(1.15)
    setRotation(0)
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  // 适应宽度计算
  const handleFitWidth = async () => {
    if (!pdfDoc || !containerRef.current) return
    try {
      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 1, rotation })
      const containerWidth = containerRef.current.clientWidth - 48
      if (containerWidth > 0 && viewport.width > 0) {
        const fitScale = Number((containerWidth / viewport.width).toFixed(2))
        setScale(Math.max(0.5, Math.min(fitScale, 3.0)))
      }
    } catch (err) {
      console.warn('Fit width calculation failed:', err)
    }
  }

  const content = (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#525659',
        padding: '20px 16px',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {loading ? (
        <div
          style={{
            height: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 13, color: '#e6f7ff' }}>
            正在解析 PDF 文档，请稍候...
          </div>
        </div>
      ) : errorMsg ? (
        <div style={{ maxWidth: 500, margin: '60px auto' }}>
          <Alert
            type="error"
            showIcon
            message="PDF 预览失败"
            description={
              <div>
                <p style={{ margin: '4px 0' }}>{errorMsg}</p>
                <p style={{ margin: '4px 0', fontSize: 12, color: '#8c8c8c' }}>
                  提示：您可以点击下方重新尝试，或直接使用【外跳打开】/【下载发客户】。
                </p>
              </div>
            }
            action={
              <Button size="small" danger icon={<ReloadOutlined />} onClick={loadPdf}>
                重试加载
              </Button>
            }
          />
        </div>
      ) : pdfDoc && numPages > 0 ? (
        <div style={{ display: 'inline-block' }}>
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <PdfPageItem
              key={`${pdfDoc.fingerprints?.[0] || 'doc'}-p${pageNum}-${scale}-${rotation}`}
              pdfDoc={pdfDoc}
              pageNum={pageNum}
              scale={scale}
              rotation={rotation}
            />
          ))}
        </div>
      ) : (
        <div style={{ color: '#fff', marginTop: 80 }}>暂无 PDF 数据</div>
      )}
    </div>
  )

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height,
        background: '#323639',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 14px',
          background: '#1f1f1f',
          borderBottom: '1px solid #383838',
          color: '#fff',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Space size="small">
          <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>PDF 方案阅读器</span>
          {numPages > 0 && (
            <Tag color="blue" style={{ margin: 0 }}>
              共 {numPages} 页
            </Tag>
          )}
        </Space>

        <Space size="middle">
          <Space.Compact size="small">
            <Tooltip title="缩小 (-15%)">
              <Button
                ghost
                icon={<ZoomOutOutlined />}
                disabled={scale <= 0.5 || !pdfDoc}
                onClick={handleZoomOut}
              />
            </Tooltip>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 10px',
                color: '#fff',
                fontSize: 12,
                minWidth: 50,
                background: '#2b2b2b',
                userSelect: 'none',
              }}
            >
              {Math.round(scale * 100)}%
            </span>
            <Tooltip title="放大 (+15%)">
              <Button
                ghost
                icon={<ZoomInOutlined />}
                disabled={scale >= 3.0 || !pdfDoc}
                onClick={handleZoomIn}
              />
            </Tooltip>
          </Space.Compact>

          <Tooltip title="适应窗口宽度">
            <Button
              size="small"
              ghost
              icon={<ColumnWidthOutlined />}
              disabled={!pdfDoc}
              onClick={handleFitWidth}
            >
              适应宽度
            </Button>
          </Tooltip>

          <Tooltip title="顺时针旋转 90 度">
            <Button
              size="small"
              ghost
              icon={<RotateRightOutlined />}
              disabled={!pdfDoc}
              onClick={handleRotate}
            >
              旋转
            </Button>
          </Tooltip>

          <Tooltip title="重置尺寸与方向">
            <Button
              size="small"
              ghost
              icon={<ReloadOutlined />}
              disabled={!pdfDoc}
              onClick={handleResetZoom}
            >
              重置
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* 渲染区域（可带水印） */}
      {watermarkText ? (
        <Watermark
          content={watermarkText}
          gap={[100, 100]}
          font={{ color: 'rgba(0, 0, 0, 0.12)', fontSize: 14 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          {content}
        </Watermark>
      ) : (
        content
      )}
    </div>
  )
}
