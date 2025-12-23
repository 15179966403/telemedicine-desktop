import type { WindowInfo } from '@/types'

export interface WindowOptions {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  resizable?: boolean
  maximizable?: boolean
  minimizable?: boolean
  center?: boolean
  alwaysOnTop?: boolean
}

export class WindowService {
  private static instance: WindowService

  static getInstance(): WindowService {
    if (!WindowService.instance) {
      WindowService.instance = new WindowService()
    }
    return WindowService.instance
  }

  async createWindow(
    type: WindowInfo['type'],
    data?: any,
    options?: WindowOptions
  ): Promise<string> {
    try {
      console.log('WindowService.createWindow called with:', { type, data, options })

      const windowId = `${type}-${Date.now()}`
      const defaultOptions = this.getDefaultWindowOptions(type)
      const finalOptions = { ...defaultOptions, ...options }

      // TODO: 调用 Tauri API 创建窗口
      // const window = new WebviewWindow(windowId, {
      //   url: this.getWindowUrl(type, data),
      //   title: this.getWindowTitle(type, data),
      //   ...finalOptions
      // })

      // 模拟窗口创建
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log('Window created:', windowId)
      return windowId
    } catch (error) {
      console.error('Create window failed:', error)
      throw new Error('创建窗口失败')
    }
  }

  async closeWindow(windowId: string): Promise<void> {
    try {
      console.log('WindowService.closeWindow called with:', windowId)

      // TODO: 调用 Tauri API 关闭窗口
      // const window = WebviewWindow.getByLabel(windowId)
      // if (window) {
      //   await window.close()
      // }

      // 模拟窗口关闭
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log('Window closed:', windowId)
    } catch (error) {
      console.error('Close window failed:', error)
      throw new Error('关闭窗口失败')
    }
  }

  async focusWindow(windowId: string): Promise<void> {
    try {
      console.log('WindowService.focusWindow called with:', windowId)

      // TODO: 调用 Tauri API 聚焦窗口
      // const window = WebviewWindow.getByLabel(windowId)
      // if (window) {
      //   await window.setFocus()
      // }

      console.log('Window focused:', windowId)
    } catch (error) {
      console.error('Focus window failed:', error)
      // 聚焦失败不应该抛出错误
    }
  }

  async minimizeWindow(windowId: string): Promise<void> {
    try {
      console.log('WindowService.minimizeWindow called with:', windowId)

      // TODO: 调用 Tauri API 最小化窗口
      // const window = WebviewWindow.getByLabel(windowId)
      // if (window) {
      //   await window.minimize()
      // }

      console.log('Window minimized:', windowId)
    } catch (error) {
      console.error('Minimize window failed:', error)
    }
  }

  async maximizeWindow(windowId: string): Promise<void> {
    try {
      console.log('WindowService.maximizeWindow called with:', windowId)

      // TODO: 调用 Tauri API 最大化窗口
      // const window = WebviewWindow.getByLabel(windowId)
      // if (window) {
      //   await window.maximize()
      // }

      console.log('Window maximized:', windowId)
    } catch (error) {
      console.error('Maximize window failed:', error)
    }
  }

  async setWindowTitle(windowId: string, title: string): Promise<void> {
    try {
      console.log('WindowService.setWindowTitle called with:', { windowId, title })

      // TODO: 调用 Tauri API 设置窗口标题
      // const window = WebviewWindow.getByLabel(windowId)
      // if (window) {
      //   await window.setTitle(title)
      // }

      console.log('Window title set:', { windowId, title })
    } catch (error) {
      console.error('Set window title failed:', error)
    }
  }

  async getAllWindows(): Promise<string[]> {
    try {
      console.log('WindowService.getAllWindows called')

      // TODO: 调用 Tauri API 获取所有窗口
      // const windows = await WebviewWindow.getAll()
      // return windows.map(w => w.label)

      // 模拟返回窗口列表
      return ['main']
    } catch (error) {
      console.error('Get all windows failed:', error)
      return []
    }
  }

  private getDefaultWindowOptions(type: WindowInfo['type']): WindowOptions {
    switch (type) {
      case 'main':
        return {
          width: 1200,
          height: 800,
          minWidth: 800,
          minHeight: 600,
          resizable: true,
          maximizable: true,
          minimizable: true,
          center: true,
        }
      case 'consultation':
        return {
          width: 800,
          height: 600,
          minWidth: 600,
          minHeight: 400,
          resizable: true,
          maximizable: true,
          minimizable: true,
          center: false,
        }
      case 'patient':
        return {
          width: 900,
          height: 700,
          minWidth: 700,
          minHeight: 500,
          resizable: true,
          maximizable: true,
          minimizable: true,
          center: false,
        }
      case 'settings':
        return {
          width: 600,
          height: 500,
          minWidth: 500,
          minHeight: 400,
          resizable: false,
          maximizable: false,
          minimizable: true,
          center: true,
        }
      default:
        return {
          width: 800,
          height: 600,
          resizable: true,
          center: true,
        }
    }
  }

  private getWindowUrl(type: WindowInfo['type'], data?: any): string {
    const baseUrl = window.location.origin

    switch (type) {
      case 'main':
        return `${baseUrl}/`
      case 'consultation':
        return `${baseUrl}/consultation${data?.consultationId ? `/${data.consultationId}` : ''}`
      case 'patient':
        return `${baseUrl}/patient${data?.patientId ? `/${data.patientId}` : ''}`
      case 'settings':
        return `${baseUrl}/settings`
      default:
        return `${baseUrl}/`
    }
  }

  private getWindowTitle(type: WindowInfo['type'], data?: any): string {
    switch (type) {
      case 'main':
        return '互联网医院 - 工作台'
      case 'consultation':
        return data?.patientName ? `问诊 - ${data.patientName}` : '问诊窗口'
      case 'patient':
        return data?.patientName ? `患者详情 - ${data.patientName}` : '患者管理'
      case 'settings':
        return '设置'
      default:
        return '互联网医院'
    }
  }
}