import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { format } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from 'antd'
import type { CustomerMemoData, CustomerMemoImage, CustomerRecord } from '@/types'
import type { AddImagesResult } from '@/services/customerMemoService'

const serviceMock = {
  isImageSupported: vi.fn(() => true),
  getMemo: vi.fn(),
  saveContent: vi.fn(),
  addImages: vi.fn(),
  getImageUrl: vi.fn(),
  deleteImage: vi.fn(),
  openFolder: vi.fn(),
  releaseImageUrls: vi.fn(),
}

vi.mock('@/services/customerMemoService', () => ({
  CustomerMemoService: { getInstance: () => serviceMock },
}))

import { CustomerMemoPanel } from '@/components/CustomerMemoPanel'

const customer: CustomerRecord = { id: '123', customerName: '张三', mobile: '13800001234' }

function image(id: string): CustomerMemoImage {
  return {
    id,
    customerId: '123',
    fileName: `${id}.jpg`,
    storedName: `${id}.jpg`,
    thumbName: `${id}_thumb.jpg`,
    mimeType: 'image/jpeg',
    fileSize: 1024,
    width: 4000,
    height: 3000,
    caption: null,
    recordDate: null,
    sortOrder: 0,
    deletedAt: null,
    createdAt: '2025-11-13T09:30:00.123Z',
  }
}

const savedImages = [image('img-1'), image('img-2')]

function mockLoadedMemo(overrides: Partial<CustomerMemoData> = {}) {
  serviceMock.getMemo.mockResolvedValue({
    customerId: '123',
    content: '随访要点',
    updatedAt: '2025-11-13T09:30:00.123Z',
    images: savedImages,
    storageRootPath: 'D:\\健康管理便签照片库',
    storageAvailable: true,
    ...overrides,
  })
}

/** 每张照片的访问地址形如 blob:img-1-thumb / blob:img-1-original */
function mockImageUrls() {
  serviceMock.getImageUrl.mockImplementation(async (img, kind) => `blob:${img.id}-${kind}`)
}

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

beforeEach(() => {
  Object.values(serviceMock).forEach(mock => mock.mockReset())
  serviceMock.isImageSupported.mockReturnValue(true)
  mockLoadedMemo()
  mockImageUrls()
})

describe('CustomerMemoPanel', () => {
  it('显示已保存的便签文本、照片数量、缩略图和保存位置', async () => {
    render(<CustomerMemoPanel customer={customer} />)

    expect(await screen.findByDisplayValue('随访要点')).toBeInTheDocument()
    expect(serviceMock.getMemo).toHaveBeenCalledWith('123')
    expect(await screen.findByText('共 2 张 · 约 2 KB')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: '照片 1' })).toHaveAttribute(
      'src',
      'blob:img-1-thumb'
    )
    expect(screen.getByRole('img', { name: '照片 2' })).toHaveAttribute('src', 'blob:img-2-thumb')
    expect(screen.getByText('照片保存在：D:\\健康管理便签照片库')).toBeInTheDocument()
    // 缩略图各读取一次即可
    expect(serviceMock.getImageUrl).toHaveBeenCalledTimes(2)
    expect(serviceMock.getImageUrl).toHaveBeenCalledWith(savedImages[0], 'thumb')
  })

  it('修改后提示还没保存，点击“保存便签”才写入', async () => {
    serviceMock.saveContent.mockResolvedValue(undefined)
    render(<CustomerMemoPanel customer={customer} />)

    const textarea = await screen.findByDisplayValue('随访要点')
    const savedTime = format(new Date('2025-11-13T09:30:00.123Z'), 'yyyy-MM-dd HH:mm')
    expect(screen.getByText(`已保存 · ${savedTime}`)).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: '新增的随访要点' } })
    expect(screen.getByText('有修改还没保存')).toBeInTheDocument()
    expect(serviceMock.saveContent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /保存便签/ }))
    await waitFor(() =>
      expect(serviceMock.saveContent).toHaveBeenCalledWith('123', '新增的随访要点')
    )
    expect(await screen.findByText(/^已保存 · /)).toBeInTheDocument()
    expect(vi.mocked(message.success)).toHaveBeenCalledWith('医生随访便签保存成功')
  })

  it('保存失败时给出提示', async () => {
    serviceMock.saveContent.mockRejectedValue(new Error('磁盘写入失败'))
    render(<CustomerMemoPanel customer={customer} />)

    fireEvent.click(await screen.findByRole('button', { name: /保存便签/ }))

    await waitFor(() =>
      expect(vi.mocked(message.error)).toHaveBeenCalledWith('便签保存失败: 磁盘写入失败')
    )
  })

  it('通过“添加照片”选中的图片立即保存，保存期间显示进度', async () => {
    mockLoadedMemo({ images: [] })
    const file = new File(['photo'], '微信图片.jpg', { type: 'image/jpeg' })
    let finishAdding!: (result: AddImagesResult) => void
    serviceMock.addImages.mockReturnValue(
      new Promise<AddImagesResult>(resolve => {
        finishAdding = resolve
      })
    )
    const { container } = render(<CustomerMemoPanel customer={customer} />)
    await screen.findByDisplayValue('随访要点')

    const input = fileInput(container)
    // HEIC 也出现在选择框里，这样医生能看到如何处理的提示
    expect(input).toHaveAttribute('accept', expect.stringContaining('.heic'))
    fireEvent.change(input, { target: { files: [file, file] } })

    await waitFor(() => expect(serviceMock.addImages.mock.calls[0]?.slice(0, 2)).toEqual(['123', [file, file]]))
    expect(await screen.findByText('正在保存照片 (1/2)…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /正在保存照片/ })).toBeDisabled()

    await act(async () => {
      finishAdding({ added: [image('img-9')], failed: [] })
    })

    expect(await screen.findByRole('img', { name: '照片 1' })).toHaveAttribute(
      'src',
      'blob:img-9-thumb'
    )
    expect(screen.getByRole('button', { name: /添加照片/ })).toBeEnabled()
    expect(vi.mocked(message.success)).toHaveBeenCalledWith('已保存 1 张照片')
  })

  it('选中的不是照片、或部分照片处理失败时，说明原因', async () => {
    mockLoadedMemo({ images: [] })
    const { container } = render(<CustomerMemoPanel customer={customer} />)
    await screen.findByDisplayValue('随访要点')

    fireEvent.change(fileInput(container), {
      target: { files: [new File(['x'], '说明.docx', { type: 'application/msword' })] },
    })
    expect(vi.mocked(message.info)).toHaveBeenCalledWith('请选择照片文件（JPG、PNG、WebP）')
    expect(serviceMock.addImages).not.toHaveBeenCalled()

    const photo = new File(['photo'], 'IMG_0001.JPG', { type: 'image/jpeg' })
    serviceMock.addImages.mockResolvedValue({
      added: [],
      failed: [
        { fileName: 'IMG_0001.JPG', reason: '照片内容无法识别，文件可能已损坏' },
        { fileName: '粘贴的图片', reason: '无法保存' },
      ],
    })
    fireEvent.change(fileInput(container), { target: { files: [photo] } })

    await waitFor(() => expect(serviceMock.addImages).toHaveBeenCalledTimes(1))
    // 保存过程中会把进度回调作为第三个参数传给服务层
    expect(serviceMock.addImages.mock.calls[0]?.slice(0, 2)).toEqual(['123', [photo]])
    // antd 的 message.warning 是重载函数，这里只取它收到的参数
    const warningCalls = (message.warning as unknown as {
      mock: { calls: Array<[React.ReactElement<{ children?: React.ReactNode }>]> }
    }).mock.calls
    expect(React.Children.toArray(warningCalls[0][0].props.children).join('')).toBe(
      '2 张照片未能添加：IMG_0001.JPG（照片内容无法识别，文件可能已损坏）；粘贴的图片（无法保存）'
    )
    expect(serviceMock.getImageUrl).not.toHaveBeenCalled()
  })

  it('把微信里的照片拖到便签区域即可添加，其他文件会被忽略', async () => {
    mockLoadedMemo({ images: [] })
    serviceMock.addImages.mockResolvedValue({ added: [], failed: [] })
    const { container } = render(<CustomerMemoPanel customer={customer} />)
    await screen.findByDisplayValue('随访要点')
    const root = container.querySelector('.memo-panel') as HTMLElement
    const photo = new File(['photo'], 'a.jpg', { type: 'image/jpeg' })
    const document_ = new File(['doc'], '说明.pdf', { type: 'application/pdf' })

    fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'], files: [] } })
    expect(screen.getByText('松开鼠标，照片就会加入这位客户的便签')).toBeInTheDocument()

    fireEvent.drop(root, { dataTransfer: { types: ['Files'], files: [photo, document_] } })
    await waitFor(() => expect(serviceMock.addImages.mock.calls[0]?.slice(0, 2)).toEqual(['123', [photo]]))
    expect(screen.queryByText('松开鼠标，照片就会加入这位客户的便签')).not.toBeInTheDocument()

    fireEvent.drop(root, { dataTransfer: { types: ['Files'], files: [document_] } })
    await waitFor(() =>
      expect(vi.mocked(message.info)).toHaveBeenCalledWith('请拖入照片文件（JPG、PNG、WebP）')
    )
    expect(serviceMock.addImages).toHaveBeenCalledTimes(1)
  })

  it('没对准便签区域就松手时，不会让浏览器直接打开这个文件；拖动文字不受影响', async () => {
    render(<CustomerMemoPanel customer={customer} />)
    await screen.findByDisplayValue('随访要点')

    const fireDragEvent = (type: 'drop' | 'dragover', types: string[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: { types } })
      window.dispatchEvent(event)
      return event
    }

    expect(fireDragEvent('drop', ['Files']).defaultPrevented).toBe(true)
    expect(fireDragEvent('dragover', ['Files']).defaultPrevented).toBe(true)
    // 在输入框里拖动选中文字：types 里没有 Files，保持浏览器默认行为
    expect(fireDragEvent('drop', ['text/plain']).defaultPrevented).toBe(false)
    expect(fireDragEvent('dragover', ['text/plain']).defaultPrevented).toBe(false)
  })

  it('在便签上按 Ctrl+V 粘贴图片会直接添加', async () => {
    mockLoadedMemo({ images: [] })
    serviceMock.addImages.mockResolvedValue({ added: [], failed: [] })
    render(<CustomerMemoPanel customer={customer} />)
    await screen.findByDisplayValue('随访要点')
    const pasted = new File(['clip'], 'image.png', { type: 'image/png' })

    // 没有图片的普通粘贴不处理
    fireEvent.paste(document, {
      clipboardData: { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] },
    })
    expect(serviceMock.addImages).not.toHaveBeenCalled()

    fireEvent.paste(document, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => pasted }],
      },
    })
    await waitFor(() => expect(serviceMock.addImages.mock.calls[0]?.slice(0, 2)).toEqual(['123', [pasted]]))
  })

  it('点击照片时先读取原图，再打开大图预览', async () => {
    // antd 预览打开时会带伪元素参数调用 getComputedStyle，jsdom 没有实现，这里忽略第二个参数
    const getComputedStyle = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      ((element: Element) => getComputedStyle(element)) as typeof window.getComputedStyle
    )
    render(<CustomerMemoPanel customer={customer} />)

    fireEvent.click(await screen.findByRole('button', { name: '照片 2' }))

    await waitFor(() => expect(serviceMock.getImageUrl).toHaveBeenCalledWith(savedImages[1], 'original'))
    await waitFor(() =>
      expect(document.querySelector('.ant-image-preview-img')).toHaveAttribute(
        'src',
        'blob:img-2-original'
      )
    )
  })

  it('删除照片需要确认；确认框里的点击不会误触发预览', async () => {
    serviceMock.deleteImage.mockResolvedValue(undefined)
    render(<CustomerMemoPanel customer={customer} />)

    const tile = await screen.findByRole('button', { name: '照片 1' })
    await waitFor(() => expect(screen.getByRole('img', { name: '照片 1' })).toBeInTheDocument())
    fireEvent.click(within(tile).getByRole('button', { name: '删除这张照片' }))
    expect(serviceMock.deleteImage).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(serviceMock.deleteImage).toHaveBeenCalledWith('123', 'img-1'))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '照片 2' })).not.toBeInTheDocument()
    )
    // 原来第 2 张照片现在排在第 1 位
    expect(screen.getByRole('button', { name: '照片 1' })).toHaveAttribute(
      'title',
      expect.stringMatching(/^img-2\.jpg（.+ 添加）$/)
    )
    expect(screen.getByText('共 1 张 · 约 1 KB')).toBeInTheDocument()
    expect(serviceMock.getImageUrl).not.toHaveBeenCalledWith(expect.anything(), 'original')
    expect(vi.mocked(message.success)).toHaveBeenCalledWith('照片已删除')
  })

  it('照片文件丢失时显示占位，点击时给出提示', async () => {
    mockLoadedMemo({ images: [image('img-1')] })
    serviceMock.getImageUrl.mockRejectedValue(new Error('文件不存在'))
    render(<CustomerMemoPanel customer={customer} />)

    expect(await screen.findByText('文件丢失')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '照片 1' }))

    await waitFor(() =>
      expect(vi.mocked(message.error)).toHaveBeenCalledWith('这张照片的文件已经找不到，无法放大查看')
    )
  })

  it('照片库所在磁盘不可用时给出明确提示', async () => {
    mockLoadedMemo({ images: [], storageAvailable: false })
    render(<CustomerMemoPanel customer={customer} />)

    expect(
      await screen.findByText('便签照片库所在的磁盘现在不可用，暂时无法查看或添加照片')
    ).toBeInTheDocument()
    expect(screen.getByText('照片库位置：D:\\健康管理便签照片库')).toBeInTheDocument()
  })

  it('客户缺少系统档案编号时给出提示，不会存到错误的客户名下', () => {
    // 后台数据异常时可能出现没有档案编号的客户
    render(
      <CustomerMemoPanel
        customer={{ customerName: '张三', mobile: '13800001234' } as unknown as CustomerRecord}
      />
    )

    expect(screen.getByText('当前客户缺少系统档案编号，无法使用随访便签')).toBeInTheDocument()
    expect(serviceMock.getMemo).not.toHaveBeenCalled()
  })

  it('关闭便签时释放照片占用的内存', async () => {
    const { unmount } = render(<CustomerMemoPanel customer={customer} />)
    await screen.findByDisplayValue('随访要点')

    unmount()

    expect(serviceMock.releaseImageUrls).toHaveBeenCalledWith()
  })
})
