import { API_BASE_URL, STORAGE_KEYS } from '@/utils/constants'
import { useAuthStore } from '@/stores/authStore'
import type { ServiceRecord } from '@/types/patient'

export interface DictItem {
  dictCode?: number | string
  dictLabel: string
  dictValue: string
  dictType?: string
  isDefault?: string
  status?: string
  cssClass?: string
  listClass?: string
}

// 常用默认字典回退（当网络离线或接口异常时保障前端页面绝不崩溃）
const FALLBACK_DICTS: Record<string, DictItem[]> = {
  service_type: [
    { dictLabel: '三好管家服务', dictValue: '1' },
    { dictLabel: '蓝卡会员', dictValue: '2' },
    { dictLabel: '黑卡会员', dictValue: '3' },
    { dictLabel: '金卡会员', dictValue: '4' },
    { dictLabel: '体验营服务', dictValue: '5' },
    { dictLabel: '体检专属健康卡', dictValue: '6' },
    { dictLabel: '慢病干预服务卡', dictValue: '7' },
  ],
  bank_service_label: [
    { dictLabel: '三好卡', dictValue: '0' },
    { dictLabel: '金穗卡', dictValue: '2' },
    { dictLabel: '浦易卡', dictValue: '3' },
    { dictLabel: '联好金卡', dictValue: '6' },
    { dictLabel: '企微专属', dictValue: '7' },
  ],
  equity_type: [
    { dictLabel: '慢病阶段性管理', dictValue: '1' },
    { dictLabel: '三好管家问诊解读', dictValue: '2' },
    { dictLabel: '名医绿通及专家门诊', dictValue: '3' },
    { dictLabel: '就医陪诊与检查预约', dictValue: '4' },
  ],
}

export class DictService {
  private static instance: DictService
  private memoryCache: Map<string, DictItem[]> = new Map()

  static getInstance(): DictService {
    if (!DictService.instance) {
      DictService.instance = new DictService()
    }
    return DictService.instance
  }

  /**
   * 获取鉴权 Headers
   */
  private getAuthHeaders(): Record<string, string> {
    let token = ''
    if (typeof window !== 'undefined') {
      token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || ''
    }
    if (!token) {
      token = useAuthStore.getState().token || ''
    }

    return {
      'Content-Type': 'application/json;charset=utf-8',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  /**
   * 根据字典类型查询字典数据（对接后台 /system/dict/data/type/{dictType}）
   * @param dictType 字典类型，如 'service_type'、'bank_service_label' 等
   */
  async getDicts(dictType: string): Promise<DictItem[]> {
    // 1. 优先读取内存缓存
    if (this.memoryCache.has(dictType)) {
      return this.memoryCache.get(dictType)!
    }

    // 2. 检查本地存储缓存
    const cacheKey = `dict_cache_${dictType}`
    try {
      const localCached = localStorage.getItem(cacheKey)
      if (localCached) {
        const parsed = JSON.parse(localCached) as DictItem[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache.set(dictType, parsed)
          // 异步静默刷新
          this.fetchRemoteDict(dictType, cacheKey).catch(() => {})
          return parsed
        }
      }
    } catch {
      // ignore
    }

    // 3. 发送远端请求
    try {
      const items = await this.fetchRemoteDict(dictType, cacheKey)
      if (items.length > 0) {
        return items
      }
    } catch (err) {
      console.warn(`[DictService] Fetch dict ${dictType} failed, fallback to defaults:`, err)
    }

    // 4. 回退预置数据
    const fallbacks = FALLBACK_DICTS[dictType] || []
    return fallbacks
  }

  private async fetchRemoteDict(dictType: string, cacheKey: string): Promise<DictItem[]> {
    const res = await fetch(`${API_BASE_URL}/system/dict/data/type/${dictType}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const json = await res.json()
    if (json.code === 200 && Array.isArray(json.data)) {
      const items: DictItem[] = json.data.map((item: any) => ({
        dictCode: item.dictCode,
        dictLabel: item.dictLabel,
        dictValue: String(item.dictValue),
        dictType: item.dictType,
        isDefault: item.isDefault,
        status: item.status,
        cssClass: item.cssClass,
        listClass: item.listClass,
      }))

      this.memoryCache.set(dictType, items)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(items))
      } catch {
        // ignore storage error
      }
      return items
    }

    return []
  }

  /**
   * 解析服务类型显示文案
   * 对齐后台 getCodeType(row.codeType)
   */
  getCodeTypeLabel(codeType: number | string | undefined, dicts?: DictItem[]): string {
    if (codeType === undefined || codeType === null || codeType === '') {
      return '普通服务'
    }
    const list = dicts || this.memoryCache.get('service_type') || FALLBACK_DICTS['service_type']
    const strCode = String(codeType).trim()
    const found = list.find(d => String(d.dictValue).trim() === strCode)
    if (found) {
      return found.dictLabel
    }
    return `服务类型(${codeType})`
  }

  /**
   * 解析客户标识（客户类型/卡种）
   * 对应后台 bankLabel / recordsType / bank_service_label
   */
  getCustomerLabel(
    record: Partial<ServiceRecord> | { bankLabel?: string; recordsType?: number | string },
    dicts?: DictItem[]
  ): { text: string; color: string } {
    // 1. 若已有后台清洗好的 bankLabel，直接展示
    if (record.bankLabel && record.bankLabel.trim()) {
      const text = record.bankLabel.trim()
      let color = 'blue'
      if (text.includes('金穗')) color = 'success'
      else if (text.includes('浦') || text.includes('易')) color = 'orange'
      else if (text.includes('企微')) color = 'cyan'
      else if (text.includes('三好')) color = 'geekblue'
      return { text, color }
    }

    // 2. 匹配 bank_service_label 字典
    const recordsType = record.recordsType
    if (recordsType !== undefined && recordsType !== null && recordsType !== '') {
      const strType = String(recordsType).trim()
      const list = dicts || this.memoryCache.get('bank_service_label') || FALLBACK_DICTS['bank_service_label']
      const found = list.find(d => String(d.dictValue).trim() === strType)
      if (found) {
        let color = 'blue'
        if (found.dictLabel.includes('金穗')) color = 'success'
        else if (found.dictLabel.includes('浦') || found.dictLabel.includes('易')) color = 'orange'
        else if (found.dictLabel.includes('企微')) color = 'cyan'
        return { text: found.dictLabel, color }
      }

      // 3. 常见数字枚举匹配
      const num = Number(recordsType)
      if (num === 0) return { text: '三好卡', color: 'blue' }
      if (num === 2) return { text: '金穗卡', color: 'success' }
      if (num === 3) return { text: '浦易卡', color: 'orange' }
      if (num === 6) return { text: '联好金卡', color: 'gold' }
      if (num === 7) return { text: '企微专属', color: 'cyan' }

      return { text: `标识(${recordsType})`, color: 'default' }
    }

    return { text: '标准客户', color: 'default' }
  }
}
