/**
 * 客户随访便签（医生本地标记）相关类型
 * 与 Rust 端 src-tauri/src/models/memo.rs 对应
 */

/** 便签照片元数据（照片文件保存在便签照片库目录） */
export interface CustomerMemoImage {
  id: string
  customerId: string
  /** 医生添加时的原始文件名 */
  fileName: string | null
  storedName: string
  thumbName: string | null
  mimeType: string | null
  fileSize: number
  width: number | null
  height: number | null
  caption: string | null
  recordDate: string | null
  sortOrder: number
  deletedAt: string | null
  createdAt: string | null
}

/** 客户的完整便签：文本 + 照片列表 */
export interface CustomerMemoData {
  customerId: string
  content: string
  updatedAt: string | null
  images: CustomerMemoImage[]
  /** 便签照片库根目录 */
  storageRootPath: string
  /** 照片库所在磁盘是否可用（不可用时文本仍可读写） */
  storageAvailable: boolean
}
