// 本地存储工具函数

import { STORAGE_KEYS } from './constants'

/**
 * 本地存储管理类
 */
export class StorageManager {
  private static instance: StorageManager

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager()
    }
    return StorageManager.instance
  }

  /**
   * 设置存储项
   */
  setItem<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value)
      localStorage.setItem(key, serializedValue)
    } catch (error) {
      console.error('Failed to set storage item:', error)
    }
  }

  /**
   * 获取存储项
   */
  getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key)
      if (item === null) {
        return defaultValue ?? null
      }
      return JSON.parse(item) as T
    } catch (error) {
      console.error('Failed to get storage item:', error)
      return defaultValue ?? null
    }
  }

  /**
   * 移除存储项
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to remove storage item:', error)
    }
  }

  /**
   * 清空所有存储
   */
  clear(): void {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }

  /**
   * 检查存储项是否存在
   */
  hasItem(key: string): boolean {
    return localStorage.getItem(key) !== null
  }

  /**
   * 获取所有存储键
   */
  getAllKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * 获取存储大小（字节）
   */
  getStorageSize(): number {
    let total = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length
      }
    }
    return total
  }
}

/**
 * 会话存储管理类
 */
export class SessionStorageManager {
  private static instance: SessionStorageManager

  static getInstance(): SessionStorageManager {
    if (!SessionStorageManager.instance) {
      SessionStorageManager.instance = new SessionStorageManager()
    }
    return SessionStorageManager.instance
  }

  setItem<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value)
      sessionStorage.setItem(key, serializedValue)
    } catch (error) {
      console.error('Failed to set session storage item:', error)
    }
  }

  getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = sessionStorage.getItem(key)
      if (item === null) {
        return defaultValue ?? null
      }
      return JSON.parse(item) as T
    } catch (error) {
      console.error('Failed to get session storage item:', error)
      return defaultValue ?? null
    }
  }

  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to remove session storage item:', error)
    }
  }

  clear(): void {
    try {
      sessionStorage.clear()
    } catch (error) {
      console.error('Failed to clear session storage:', error)
    }
  }
}

/**
 * 缓存管理类（带过期时间）
 */
export class CacheManager {
  private static instance: CacheManager
  private storage: StorageManager

  constructor() {
    this.storage = StorageManager.getInstance()
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  /**
   * 设置缓存（带过期时间）
   */
  setCache<T>(key: string, value: T, ttl: number = 3600000): void {
    const cacheItem = {
      value,
      timestamp: Date.now(),
      ttl,
    }
    this.storage.setItem(`cache_${key}`, cacheItem)
  }

  /**
   * 获取缓存
   */
  getCache<T>(key: string): T | null {
    const cacheItem = this.storage.getItem<{
      value: T
      timestamp: number
      ttl: number
    }>(`cache_${key}`)

    if (!cacheItem) {
      return null
    }

    const now = Date.now()
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      // 缓存已过期，删除并返回null
      this.removeCache(key)
      return null
    }

    return cacheItem.value
  }

  /**
   * 移除缓存
   */
  removeCache(key: string): void {
    this.storage.removeItem(`cache_${key}`)
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    const keys = this.storage.getAllKeys()
    const now = Date.now()

    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        const cacheItem = this.storage.getItem<{
          timestamp: number
          ttl: number
        }>(key)

        if (cacheItem && now - cacheItem.timestamp > cacheItem.ttl) {
          this.storage.removeItem(key)
        }
      }
    })
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalItems: number
    expiredItems: number
    totalSize: number
  } {
    const keys = this.storage.getAllKeys()
    const now = Date.now()
    let totalItems = 0
    let expiredItems = 0
    let totalSize = 0

    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        totalItems++
        const item = localStorage.getItem(key)
        if (item) {
          totalSize += item.length

          try {
            const cacheItem = JSON.parse(item)
            if (now - cacheItem.timestamp > cacheItem.ttl) {
              expiredItems++
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    })

    return { totalItems, expiredItems, totalSize }
  }
}

// 便捷函数
const storage = StorageManager.getInstance()
const sessionStorage = SessionStorageManager.getInstance()
const cache = CacheManager.getInstance()

// 认证相关存储
export const authStorage = {
  setToken: (token: string) => storage.setItem(STORAGE_KEYS.AUTH_TOKEN, token),
  getToken: () => storage.getItem<string>(STORAGE_KEYS.AUTH_TOKEN),
  removeToken: () => storage.removeItem(STORAGE_KEYS.AUTH_TOKEN),

  setUserInfo: (userInfo: any) =>
    storage.setItem(STORAGE_KEYS.USER_INFO, userInfo),
  getUserInfo: () => storage.getItem(STORAGE_KEYS.USER_INFO),
  removeUserInfo: () => storage.removeItem(STORAGE_KEYS.USER_INFO),

  clearAuth: () => {
    storage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    storage.removeItem(STORAGE_KEYS.USER_INFO)
  },
}

// 主题存储
export const themeStorage = {
  setTheme: (theme: string) => storage.setItem(STORAGE_KEYS.THEME, theme),
  getTheme: () => storage.getItem<string>(STORAGE_KEYS.THEME, 'light'),
}

// 窗口状态存储
export const windowStorage = {
  setWindowState: (state: any) =>
    storage.setItem(STORAGE_KEYS.WINDOW_STATE, state),
  getWindowState: () => storage.getItem(STORAGE_KEYS.WINDOW_STATE),
  removeWindowState: () => storage.removeItem(STORAGE_KEYS.WINDOW_STATE),
}

// 患者缓存
export const patientCache = {
  setPatients: (
    patients: any[],
    ttl: number = 300000 // 5分钟缓存
  ) => cache.setCache(STORAGE_KEYS.PATIENT_CACHE, patients, ttl),
  getPatients: () => cache.getCache(STORAGE_KEYS.PATIENT_CACHE),
  clearPatients: () => cache.removeCache(STORAGE_KEYS.PATIENT_CACHE),
}

// 消息缓存
export const messageCache = {
  setMessages: (
    consultationId: string,
    messages: any[],
    ttl: number = 600000 // 10分钟缓存
  ) =>
    cache.setCache(
      `${STORAGE_KEYS.MESSAGE_CACHE}_${consultationId}`,
      messages,
      ttl
    ),
  getMessages: (consultationId: string) =>
    cache.getCache(`${STORAGE_KEYS.MESSAGE_CACHE}_${consultationId}`),
  clearMessages: (consultationId: string) =>
    cache.removeCache(`${STORAGE_KEYS.MESSAGE_CACHE}_${consultationId}`),
}

export { storage, sessionStorage, cache }
