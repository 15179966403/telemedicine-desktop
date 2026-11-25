/**
 * 客户随访便签服务
 *
 * 便签文本存本地数据库，照片存便签照片库目录，均通过 Rust 端读写。
 * 旧版本把便签文本存在 localStorage，读取时自动迁入数据库。
 */
import { invoke } from '@tauri-apps/api/core'
import type { CustomerMemoData, CustomerMemoImage } from '@/types'
import { createImageVariants } from '@/utils/compression'
import { isDesktopApp } from '@/services/desktopEnv'

/** 旧版本存放便签文本的 localStorage key 前缀 */
const LEGACY_MEMO_KEY_PREFIX = 'doctor_memo_cust_'
/** 请求体开头用 4 个字节存放元数据长度 */
const META_LENGTH_BYTES = 4

export interface AddImageMeta {
  customerId: string
  fileName: string | null
  mimeType: string
  width: number
  height: number
  /** 缩略图的字节数，它前面的数据都是原图 */
  thumbSize: number
}

export interface AddImagesFailure {
  fileName: string
  reason: string
}

export interface AddImagesResult {
  added: CustomerMemoImage[]
  failed: AddImagesFailure[]
}

export function getLegacyMemoKey(customerId: string): string {
  return `${LEGACY_MEMO_KEY_PREFIX}${customerId}`
}

/**
 * 组装“添加照片”的请求体，布局与 Rust 端 memo::parse_add_image_payload 一致：
 * [4 字节：元数据长度（小端）][元数据 JSON][原图][缩略图]
 *
 * 照片整段以二进制传输：如果放进普通参数对象里，会被转成 JSON 数字数组，几兆字节的照片要传很久。
 */
export function buildAddImagePayload(
  meta: AddImageMeta,
  original: Uint8Array,
  thumb: Uint8Array
): Uint8Array {
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta))
  if (metaBytes.length > 0xffffffff) {
    throw new Error('照片信息过长')
  }
  const payload = new Uint8Array(
    META_LENGTH_BYTES + metaBytes.length + original.length + thumb.length
  )
  new DataView(payload.buffer).setUint32(0, metaBytes.length, true)
  payload.set(metaBytes, META_LENGTH_BYTES)
  payload.set(original, META_LENGTH_BYTES + metaBytes.length)
  payload.set(thumb, META_LENGTH_BYTES + metaBytes.length + original.length)
  return payload
}

export class CustomerMemoService {
  private static instance: CustomerMemoService

  /** 已读取的照片访问地址（Blob URL），键为 `${照片编号}:${thumb|original}` */
  private imageUrls = new Map<string, string>()
  private pendingUrls = new Map<string, Promise<string>>()

  static getInstance(): CustomerMemoService {
    if (!CustomerMemoService.instance) {
      CustomerMemoService.instance = new CustomerMemoService()
    }
    return CustomerMemoService.instance
  }

  /** 当前环境是否支持便签照片（需要桌面端的 Rust 端读写文件） */
  isImageSupported(): boolean {
    return isDesktopApp()
  }

  async getMemo(customerId: string): Promise<CustomerMemoData> {
    // 浏览器里直接调试时没有 Rust 端：沿用旧做法读写 localStorage，照片不可用
    if (!isDesktopApp()) {
      return {
        customerId,
        content: readLegacyMemo(getLegacyMemoKey(customerId)) ?? '',
        updatedAt: null,
        images: [],
        storageRootPath: '',
        storageAvailable: false,
      }
    }
    const data = await invoke<CustomerMemoData>('get_customer_memo', { customerId })
    return this.migrateLegacyContent(customerId, data)
  }

  /** 旧版本的便签文本在数据库里保存成功后，才删除 localStorage 里的旧值 */
  private async migrateLegacyContent(
    customerId: string,
    data: CustomerMemoData
  ): Promise<CustomerMemoData> {
    const legacyKey = getLegacyMemoKey(customerId)
    const legacy = readLegacyMemo(legacyKey)
    if (legacy === null) {
      return data
    }
    let merged = data
    if (legacy && !data.content) {
      const saved = await invoke<{ updatedAt: string | null }>('save_customer_memo_content', {
        customerId,
        content: legacy,
      })
      merged = { ...data, content: legacy, updatedAt: saved.updatedAt }
    }
    try {
      localStorage.removeItem(legacyKey)
    } catch {
      // 旧值没删掉也不影响使用，下次读取时会再清理
    }
    return merged
  }

  async saveContent(customerId: string, content: string): Promise<void> {
    if (!isDesktopApp()) {
      try {
        localStorage.setItem(getLegacyMemoKey(customerId), content)
        return
      } catch {
        throw new Error('便签保存失败')
      }
    }
    await invoke('save_customer_memo_content', { customerId, content })
  }

  /**
   * 逐张添加照片。单张失败不影响其余照片，失败原因汇总在返回值里。
   * onProgress 在处理每张照片之前调用一次（done 从 0 开始）。
   */
  async addImages(
    customerId: string,
    files: File[],
    onProgress?: (done: number, total: number) => void
  ): Promise<AddImagesResult> {
    if (!isDesktopApp()) {
      throw new Error('添加便签照片需要在桌面端应用中使用')
    }
    const result: AddImagesResult = { added: [], failed: [] }
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      onProgress?.(index, files.length)
      try {
        result.added.push(await this.addImage(customerId, file))
      } catch (err) {
        result.failed.push({
          fileName: file.name || '粘贴的图片',
          reason: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return result
  }

  private async addImage(customerId: string, file: File): Promise<CustomerMemoImage> {
    // 解码、按需压缩并生成缩略图
    const variants = await createImageVariants(file)
    const [original, thumb] = await Promise.all([
      new Uint8Array(await variants.original.arrayBuffer()),
      new Uint8Array(await variants.thumbnail.arrayBuffer()),
    ])
    const payload = buildAddImagePayload(
      {
        customerId,
        fileName: file.name || null,
        mimeType: variants.originalMimeType,
        width: variants.width,
        height: variants.height,
        thumbSize: thumb.length,
      },
      original,
      thumb
    )
    return invoke<CustomerMemoImage>('add_memo_image', payload)
  }

  async deleteImage(customerId: string, imageId: string): Promise<void> {
    await invoke('delete_memo_image', { customerId, imageId })
    this.releaseImageUrls(imageId)
  }

  /** 获取照片的本地访问地址（Blob URL）。同一张照片只从磁盘读取一次 */
  getImageUrl(image: CustomerMemoImage, kind: 'thumb' | 'original'): Promise<string> {
    const key = `${image.id}:${kind}`
    const cached = this.imageUrls.get(key)
    if (cached) {
      return Promise.resolve(cached)
    }
    const pending = this.pendingUrls.get(key)
    if (pending) {
      return pending
    }

    const task = (async () => {
      const buffer = await invoke<ArrayBuffer>('read_memo_image', {
        customerId: image.customerId,
        imageId: image.id,
        kind,
      })
      // 缩略图统一是 JPEG，原图沿用保存时的类型
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: kind === 'thumb' ? 'image/jpeg' : image.mimeType || 'image/jpeg',
        })
      )
      this.imageUrls.set(key, url)
      this.pendingUrls.delete(key)
      return url
    })()
    this.pendingUrls.set(key, task)
    // 读取失败时不缓存，下次可以重试
    task.catch(() => this.pendingUrls.delete(key))
    return task
  }

  /** 释放照片的本地访问地址。不传照片编号时释放全部（关闭便签面板时调用） */
  releaseImageUrls(imageId?: string): void {
    const prefix = imageId ? `${imageId}:` : ''
    for (const [key, url] of Array.from(this.imageUrls)) {
      if (key.startsWith(prefix)) {
        URL.revokeObjectURL(url)
        this.imageUrls.delete(key)
      }
    }
  }

  /** 在资源管理器中打开该客户的照片目录 */
  async openFolder(customerId: string): Promise<void> {
    await invoke('open_memo_folder', { customerId })
  }
}

function readLegacyMemo(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

export const customerMemoService = CustomerMemoService.getInstance()
