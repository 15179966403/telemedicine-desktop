import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { createImageVariants } from '@/utils/compression'
import { isDesktopApp } from '@/services/desktopEnv'
import type { CustomerMemoData, CustomerMemoImage } from '@/types'

// 图片解码依赖 canvas，这里整体替身，只验证服务层的编排与传输格式
vi.mock('@/utils/compression', () => ({
  createImageVariants: vi.fn(),
}))

vi.mock('@/services/desktopEnv', () => ({
  isDesktopApp: vi.fn(() => true),
}))

import {
  CustomerMemoService,
  buildAddImagePayload,
  getLegacyMemoKey,
} from '@/services/customerMemoService'

const mockedInvoke = vi.mocked(invoke)
const mockedVariants = vi.mocked(createImageVariants)
const mockedIsDesktopApp = vi.mocked(isDesktopApp)

function image(id: string): CustomerMemoImage {
  return {
    id,
    customerId: '123',
    fileName: `${id}.jpg`,
    storedName: `${id}.jpg`,
    thumbName: `${id}_thumb.jpg`,
    mimeType: 'image/jpeg',
    fileSize: 3,
    width: 4000,
    height: 3000,
    caption: null,
    recordDate: null,
    sortOrder: 0,
    deletedAt: null,
    createdAt: '2025-11-13T09:30:00.123Z',
  }
}

function memoData(overrides: Partial<CustomerMemoData> = {}): CustomerMemoData {
  return {
    customerId: '123',
    content: '随访要点',
    updatedAt: '2025-11-13T09:30:00.123Z',
    images: [],
    storageRootPath: 'D:\\健康管理便签照片库',
    storageAvailable: true,
    ...overrides,
  }
}

/** jsdom 的 Blob 没有实现 arrayBuffer()，这里给出同签名的替身 */
function blobOf(bytes: number[]): Blob {
  return {
    type: 'image/jpeg',
    size: bytes.length,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as Blob
}

/** 不依赖服务层的代码，按约定拆开请求体（布局与 Rust 端 parse_add_image_payload 一致） */
function splitPayload(payload: Uint8Array) {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const metaLength = view.getUint32(0, true)
  const meta = JSON.parse(new TextDecoder().decode(payload.subarray(4, 4 + metaLength)))
  return { meta, data: Array.from(payload.subarray(4 + metaLength)), lowByte: payload[0], highByte: payload[1] }
}

describe('buildAddImagePayload', () => {
  it('按 [长度][元数据][原图][缩略图] 组装二进制请求体，长度为小端序', () => {
    const meta = {
      customerId: '123',
      fileName: '微信图片.jpg',
      mimeType: 'image/jpeg',
      width: 4,
      height: 3,
      thumbSize: 2,
    }
    const payload = buildAddImagePayload(meta, new Uint8Array([1, 2, 3]), new Uint8Array([9, 9]))

    const metaLength = new TextEncoder().encode(JSON.stringify(meta)).length
    const { meta: parsed, data, lowByte, highByte } = splitPayload(payload)
    expect(parsed).toEqual(meta)
    expect(data).toEqual([1, 2, 3, 9, 9])
    expect(payload.length).toBe(4 + metaLength + 5)
    // 中文文件名让元数据超过 256 字节，小端序下低位字节在前
    expect(lowByte).toBe(metaLength & 0xff)
    expect(highByte).toBe(metaLength >> 8)
  })
})

describe('CustomerMemoService', () => {
  let service: CustomerMemoService
  const getItem = vi.mocked(window.localStorage.getItem)
  const removeItem = vi.mocked(window.localStorage.removeItem)
  const setItem = vi.mocked(window.localStorage.setItem)
  let originalCreateObjectURL: typeof URL.createObjectURL | undefined
  let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined

  beforeEach(() => {
    service = new CustomerMemoService()
    mockedInvoke.mockReset()
    mockedVariants.mockReset()
    mockedIsDesktopApp.mockReset()
    mockedIsDesktopApp.mockReturnValue(true)
    getItem.mockReset()
    removeItem.mockReset()
    setItem.mockReset()

    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock'),
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      writable: true,
      configurable: true,
    })
  })

  describe('getMemo', () => {
    it('从本地数据库读取便签文本与照片列表', async () => {
      const data = memoData({ images: [image('a1')] })
      mockedInvoke.mockResolvedValue(data)

      const result = await service.getMemo('123')

      expect(result).toEqual(data)
      expect(mockedInvoke).toHaveBeenCalledTimes(1)
      expect(mockedInvoke).toHaveBeenCalledWith('get_customer_memo', { customerId: '123' })
    })

    it('旧版本存在 localStorage 的文本先写入数据库，成功后才删除旧值', async () => {
      getItem.mockImplementation(key => (key === getLegacyMemoKey('123') ? '纸质本上的旧记录' : null))
      mockedInvoke.mockImplementation(async (cmd, args) => {
        if (cmd === 'get_customer_memo') return memoData({ content: '' })
        if (cmd === 'save_customer_memo_content') {
          expect(args).toEqual({ customerId: '123', content: '纸质本上的旧记录' })
          return { updatedAt: '2025-11-24T01:00:00.000Z' }
        }
        throw new Error(`unexpected command: ${cmd}`)
      })

      const result = await service.getMemo('123')

      expect(result.content).toBe('纸质本上的旧记录')
      expect(result.updatedAt).toBe('2025-11-24T01:00:00.000Z')
      expect(removeItem).toHaveBeenCalledWith(getLegacyMemoKey('123'))
    })

    it('数据库里已有文本时保留数据库内容，只清理旧值', async () => {
      getItem.mockReturnValue('纸质本上的旧记录')
      mockedInvoke.mockResolvedValue(memoData({ content: '软件里记录的新内容' }))

      const result = await service.getMemo('123')

      expect(result.content).toBe('软件里记录的新内容')
      expect(mockedInvoke).toHaveBeenCalledTimes(1)
      expect(removeItem).toHaveBeenCalledWith(getLegacyMemoKey('123'))
    })

    it('旧文本写入数据库失败时报错并保留旧值，下次还能再迁移', async () => {
      getItem.mockReturnValue('纸质本上的旧记录')
      mockedInvoke.mockImplementation(async cmd => {
        if (cmd === 'get_customer_memo') return memoData({ content: '' })
        throw new Error('磁盘写入失败')
      })

      await expect(service.getMemo('123')).rejects.toThrow('磁盘写入失败')
      expect(removeItem).not.toHaveBeenCalled()
    })
  })

  describe('addImages', () => {
    it('逐张以二进制提交原图和缩略图，单张失败不影响其余照片', async () => {
      // 粘贴来的照片没有文件名
      const pasted = new File([], '', { type: 'image/png' })
      const fromWechat = new File([], '微信图片.jpg', { type: 'image/jpeg' })
      const broken = new File([], 'photo.jpg', { type: 'image/jpeg' })
      mockedVariants.mockImplementation(async file => {
        if (file === broken) throw new Error('照片内容无法识别，文件可能已损坏')
        return {
          original: blobOf(file === pasted ? [1, 1] : [2, 2, 2]),
          originalMimeType: file.type,
          thumbnail: blobOf([9]),
          width: 4000,
          height: 3000,
        }
      })
      mockedInvoke.mockImplementation(async (cmd, args) => {
        if (cmd !== 'add_memo_image') throw new Error(`unexpected command: ${cmd}`)
        const { meta } = splitPayload(args as Uint8Array)
        return image(`new-${meta.fileName ?? 'pasted'}`)
      })
      const onProgress = vi.fn()

      const result = await service.addImages('123', [pasted, fromWechat, broken], onProgress)

      expect(result.failed).toEqual([
        { fileName: 'photo.jpg', reason: '照片内容无法识别，文件可能已损坏' },
      ])
      expect(result.added.map(item => item.id)).toEqual(['new-pasted', 'new-微信图片.jpg'])
      expect(onProgress).toHaveBeenCalledWith(0, 3)
      expect(onProgress).toHaveBeenCalledWith(2, 3)
      expect(mockedInvoke).toHaveBeenCalledTimes(2)

      const first = splitPayload(mockedInvoke.mock.calls[0][1] as Uint8Array)
      expect(first.meta).toEqual({
        customerId: '123',
        fileName: null,
        mimeType: 'image/png',
        width: 4000,
        height: 3000,
        thumbSize: 1,
      })
      expect(first.data).toEqual([1, 1, 9])
      const second = splitPayload(mockedInvoke.mock.calls[1][1] as Uint8Array)
      expect(second.meta.fileName).toBe('微信图片.jpg')
      expect(second.data).toEqual([2, 2, 2, 9])
    })

    it('桌面端以外的环境不能添加照片', async () => {
      mockedIsDesktopApp.mockReturnValue(false)

      await expect(service.addImages('123', [])).rejects.toThrow('桌面端')
      expect(mockedInvoke).not.toHaveBeenCalled()
    })
  })

  describe('getImageUrl / deleteImage', () => {
    it('同一张照片只从磁盘读取一次，缩略图按 JPEG 生成访问地址', async () => {
      mockedInvoke.mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
      const target = image('a1')

      const [first, second] = await Promise.all([
        service.getImageUrl(target, 'thumb'),
        service.getImageUrl(target, 'thumb'),
      ])

      expect(first).toBe('blob:mock')
      expect(second).toBe('blob:mock')
      expect(mockedInvoke).toHaveBeenCalledTimes(1)
      expect(mockedInvoke).toHaveBeenCalledWith('read_memo_image', {
        customerId: '123',
        imageId: 'a1',
        kind: 'thumb',
      })
      const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0]
      expect(blob).toBeInstanceOf(Blob)
      expect((blob as Blob).type).toBe('image/jpeg')
    })

    it('原图按保存时的类型生成访问地址', async () => {
      mockedInvoke.mockResolvedValue(new ArrayBuffer(1))

      await service.getImageUrl({ ...image('a1'), mimeType: 'image/png' }, 'original')

      expect(mockedInvoke).toHaveBeenCalledWith('read_memo_image', {
        customerId: '123',
        imageId: 'a1',
        kind: 'original',
      })
      expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toMatchObject({ type: 'image/png' })
    })

    it('读取失败后可以重试', async () => {
      mockedInvoke.mockRejectedValueOnce('文件不存在')
      await expect(service.getImageUrl(image('a1'), 'thumb')).rejects.toBe('文件不存在')

      mockedInvoke.mockResolvedValueOnce(new ArrayBuffer(1))
      await expect(service.getImageUrl(image('a1'), 'thumb')).resolves.toBe('blob:mock')
      expect(mockedInvoke).toHaveBeenCalledTimes(2)
    })

    it('删除照片后释放它的访问地址，其余照片不受影响', async () => {
      mockedInvoke.mockImplementation(async cmd => {
        if (cmd === 'read_memo_image') return new ArrayBuffer(1)
        return null
      })
      await service.getImageUrl(image('a1'), 'thumb')
      await service.getImageUrl(image('a2'), 'thumb')

      await service.deleteImage('123', 'a1')

      expect(mockedInvoke).toHaveBeenLastCalledWith('delete_memo_image', {
        customerId: '123',
        imageId: 'a1',
      })
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
      // a2 仍然使用缓存；a1 需要重新读取
      await service.getImageUrl(image('a2'), 'thumb')
      expect(mockedInvoke).toHaveBeenCalledTimes(3)
      await service.getImageUrl(image('a1'), 'thumb')
      expect(mockedInvoke).toHaveBeenCalledTimes(4)
    })
  })

  describe('浏览器里直接调试（没有桌面端）', () => {
    it('便签文本沿用 localStorage，不支持照片', async () => {
      mockedIsDesktopApp.mockReturnValue(false)
      getItem.mockReturnValue('旧版便签')

      await expect(service.getMemo('123')).resolves.toMatchObject({
        content: '旧版便签',
        images: [],
        storageAvailable: false,
      })
      await service.saveContent('123', '改过的内容')

      expect(setItem).toHaveBeenCalledWith(getLegacyMemoKey('123'), '改过的内容')
      expect(mockedInvoke).not.toHaveBeenCalled()
      expect(service.isImageSupported()).toBe(false)
    })
  })
})
