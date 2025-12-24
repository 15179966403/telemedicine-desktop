/**
 * 文件和图片压缩工具
 * File and image compression utilities
 */

/**
 * 图片压缩选项
 */
export interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0-1
  mimeType?: string
}

/**
 * 压缩图片文件
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    mimeType = 'image/jpeg',
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = e => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // 计算缩放比例
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法获取canvas上下文'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('图片压缩失败'))
              return
            }

            const compressedFile = new File([blob], file.name, {
              type: mimeType,
              lastModified: Date.now(),
            })

            resolve(compressedFile)
          },
          mimeType,
          quality
        )
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 批量压缩图片
 */
export async function compressImages(
  files: File[],
  options: ImageCompressionOptions = {}
): Promise<File[]> {
  const compressionPromises = files.map(file => {
    // 只压缩图片文件
    if (file.type.startsWith('image/')) {
      return compressImage(file, options)
    }
    return Promise.resolve(file)
  })

  return Promise.all(compressionPromises)
}

/**
 * 获取图片尺寸
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = e => {
      const img = new Image()

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        })
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 检查文件是否需要压缩
 */
export function shouldCompressFile(
  file: File,
  maxSize = 5 * 1024 * 1024
): boolean {
  // 如果文件大于maxSize（默认5MB），需要压缩
  if (file.size > maxSize) {
    return true
  }

  // 如果是图片且大于1MB，建议压缩
  if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
    return true
  }

  return false
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 计算压缩率
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  if (originalSize === 0) return 0
  return ((originalSize - compressedSize) / originalSize) * 100
}

/**
 * 文件类型验证
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -2)
      return file.type.startsWith(prefix)
    }
    return file.type === type
  })
}

/**
 * 文件大小验证
 */
export function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize
}

/**
 * 创建文件缩略图
 */
export async function createThumbnail(
  file: File,
  maxSize = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = e => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(maxSize / img.width, maxSize / img.height)
        const width = img.width * ratio
        const height = img.height * ratio

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法获取canvas上下文'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}
