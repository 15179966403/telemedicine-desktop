/**
 * 撤销/重做管理器
 * Undo/Redo Manager for operation history
 */

export interface UndoableAction<T = any> {
  id: string
  type: string
  description: string
  timestamp: Date
  data: T
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
}

export interface UndoManagerConfig {
  maxHistorySize: number
  autoSave: boolean
  storageKey?: string
}

export class UndoManager {
  private undoStack: UndoableAction[] = []
  private redoStack: UndoableAction[] = []
  private config: UndoManagerConfig
  private listeners: Array<(state: UndoManagerState) => void> = []

  constructor(config: Partial<UndoManagerConfig> = {}) {
    this.config = {
      maxHistorySize: config.maxHistorySize || 50,
      autoSave: config.autoSave !== undefined ? config.autoSave : false,
      storageKey: config.storageKey || 'undo_manager_state',
    }

    // 如果启用自动保存，从存储中恢复状态
    if (this.config.autoSave && this.config.storageKey) {
      this.loadState()
    }
  }

  /**
   * 执行一个可撤销的操作
   */
  async execute(action: UndoableAction): Promise<void> {
    try {
      // 执行 redo 操作（初次执行）
      await action.redo()

      // 添加到撤销栈
      this.undoStack.push(action)

      // 限制栈大小
      if (this.undoStack.length > this.config.maxHistorySize) {
        this.undoStack.shift()
      }

      // 清空重做栈
      this.redoStack = []

      // 保存状态
      if (this.config.autoSave) {
        this.saveState()
      }

      // 通知监听器
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to execute action:', error)
      throw error
    }
  }

  /**
   * 撤销上一个操作
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      return false
    }

    const action = this.undoStack.pop()!

    try {
      await action.undo()

      // 添加到重做栈
      this.redoStack.push(action)

      // 保存状态
      if (this.config.autoSave) {
        this.saveState()
      }

      // 通知监听器
      this.notifyListeners()

      return true
    } catch (error) {
      console.error('Failed to undo action:', error)
      // 如果撤销失败，将操作放回撤销栈
      this.undoStack.push(action)
      throw error
    }
  }

  /**
   * 重做上一个撤销的操作
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      return false
    }

    const action = this.redoStack.pop()!

    try {
      await action.redo()

      // 添加回撤销栈
      this.undoStack.push(action)

      // 保存状态
      if (this.config.autoSave) {
        this.saveState()
      }

      // 通知监听器
      this.notifyListeners()

      return true
    } catch (error) {
      console.error('Failed to redo action:', error)
      // 如果重做失败，将操作放回重做栈
      this.redoStack.push(action)
      throw error
    }
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * 获取撤销栈的大小
   */
  getUndoStackSize(): number {
    return this.undoStack.length
  }

  /**
   * 获取重做栈的大小
   */
  getRedoStackSize(): number {
    return this.redoStack.length
  }

  /**
   * 获取最后一个可撤销的操作
   */
  getLastUndoAction(): UndoableAction | null {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1]
      : null
  }

  /**
   * 获取最后一个可重做的操作
   */
  getLastRedoAction(): UndoableAction | null {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1]
      : null
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []

    if (this.config.autoSave) {
      this.saveState()
    }

    this.notifyListeners()
  }

  /**
   * 获取撤销历史
   */
  getUndoHistory(): UndoableAction[] {
    return [...this.undoStack]
  }

  /**
   * 获取重做历史
   */
  getRedoHistory(): UndoableAction[] {
    return [...this.redoStack]
  }

  /**
   * 添加状态变化监听器
   */
  addListener(listener: (state: UndoManagerState) => void): () => void {
    this.listeners.push(listener)

    // 返回移除监听器的函数
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 获取当前状态
   */
  getState(): UndoManagerState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.getUndoStackSize(),
      redoStackSize: this.getRedoStackSize(),
      lastUndoAction: this.getLastUndoAction(),
      lastRedoAction: this.getLastRedoAction(),
    }
  }

  /**
   * 保存状态到本地存储
   */
  private saveState(): void {
    if (!this.config.storageKey) return

    try {
      const state = {
        undoStack: this.undoStack.map(action => ({
          id: action.id,
          type: action.type,
          description: action.description,
          timestamp: action.timestamp.toISOString(),
          data: action.data,
        })),
        redoStack: this.redoStack.map(action => ({
          id: action.id,
          type: action.type,
          description: action.description,
          timestamp: action.timestamp.toISOString(),
          data: action.data,
        })),
      }

      localStorage.setItem(this.config.storageKey, JSON.stringify(state))
    } catch (error) {
      console.error('Failed to save undo manager state:', error)
    }
  }

  /**
   * 从本地存储加载状态
   */
  private loadState(): void {
    if (!this.config.storageKey) return

    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (!stored) return

      const state = JSON.parse(stored)

      // 注意：这里只恢复了操作的元数据，实际的 undo/redo 函数需要在应用层重新绑定
      // 这是一个简化的实现，实际使用时可能需要更复杂的序列化/反序列化逻辑
      console.log('Loaded undo manager state:', state)
    } catch (error) {
      console.error('Failed to load undo manager state:', error)
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const state = this.getState()
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in undo manager listener:', error)
      }
    })
  }
}

export interface UndoManagerState {
  canUndo: boolean
  canRedo: boolean
  undoStackSize: number
  redoStackSize: number
  lastUndoAction: UndoableAction | null
  lastRedoAction: UndoableAction | null
}

/**
 * 创建一个可撤销的操作
 */
export function createUndoableAction<T>(
  type: string,
  description: string,
  data: T,
  undo: () => void | Promise<void>,
  redo: () => void | Promise<void>
): UndoableAction<T> {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    description,
    timestamp: new Date(),
    data,
    undo,
    redo,
  }
}

// 全局撤销管理器实例
export const globalUndoManager = new UndoManager({
  maxHistorySize: 50,
  autoSave: false,
})
