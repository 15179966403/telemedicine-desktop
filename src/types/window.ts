/**
 * 窗口管理相关类型定义
 * Window management related type definitions
 */

// 窗口类型
export type WindowType =
  | 'main'
  | 'consultation'
  | 'patient_detail'
  | 'settings'
  | 'notification'

// 窗口信息
export interface WindowInfo {
  id: string
  type: WindowType
  title: string
  url: string
  data: WindowData
  position: WindowPosition
  size: WindowSize
  state: WindowState
  createdAt: Date
  lastFocused: Date
}

// 窗口数据
export interface WindowData {
  consultationId?: string
  patientId?: string
  [key: string]: any
}

// 窗口位置
export interface WindowPosition {
  x: number
  y: number
}

// 窗口大小
export interface WindowSize {
  width: number
  height: number
}

// 窗口状态
export type WindowState = 'normal' | 'minimized' | 'maximized' | 'fullscreen'

// 窗口配置
export interface WindowConfig {
  type: WindowType
  title: string
  url: string
  data?: WindowData
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  resizable?: boolean
  center?: boolean
  alwaysOnTop?: boolean
}

// 窗口管理器接口
export interface WindowManager {
  createWindow(config: WindowConfig): Promise<string>
  closeWindow(windowId: string): Promise<void>
  focusWindow(windowId: string): Promise<void>
  minimizeWindow(windowId: string): Promise<void>
  maximizeWindow(windowId: string): Promise<void>
  getWindowInfo(windowId: string): Promise<WindowInfo | null>
  getAllWindows(): Promise<WindowInfo[]>
  setWindowData(windowId: string, data: WindowData): Promise<void>
}

// 窗口事件
export interface WindowEvent {
  type:
    | 'created'
    | 'closed'
    | 'focused'
    | 'minimized'
    | 'maximized'
    | 'moved'
    | 'resized'
  windowId: string
  data?: any
  timestamp: Date
}

// 窗口限制配置
export interface WindowLimits {
  maxWindows: number
  maxConsultationWindows: number
  memoryThreshold: number // MB
  cpuThreshold: number // percentage
}

// 窗口状态管理
export interface WindowState {
  windows: Map<string, WindowInfo>
  activeWindow: string | null
  limits: WindowLimits
  resourceUsage: ResourceUsage
  loading: boolean
  error: string | null
}

// 资源使用情况
export interface ResourceUsage {
  memoryUsage: number // MB
  cpuUsage: number // percentage
  windowCount: number
  lastUpdated: Date
}

// 窗口布局
export interface WindowLayout {
  id: string
  name: string
  windows: Array<{
    type: WindowType
    position: WindowPosition
    size: WindowSize
    data?: WindowData
  }>
  createdAt: Date
}

// 窗口服务接口
export interface WindowService {
  createWindow(config: WindowConfig): Promise<string>
  closeWindow(windowId: string): Promise<void>
  focusWindow(windowId: string): Promise<void>
  getResourceUsage(): Promise<ResourceUsage>
  saveLayout(name: string): Promise<WindowLayout>
  loadLayout(layoutId: string): Promise<void>
  checkLimits(): Promise<boolean>
}
