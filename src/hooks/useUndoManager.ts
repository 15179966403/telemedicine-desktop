/**
 * 撤销/重做管理 Hook
 * Undo/Redo Manager Hook
 */

import { useState, useEffect, useCallback } from 'react'
import {
  UndoManager,
  UndoableAction,
  UndoManagerState,
  createUndoableAction,
} from '@/utils/undoManager'

export function useUndoManager(manager?: UndoManager) {
  const [undoManager] = useState(
    () => manager || new UndoManager({ maxHistorySize: 50 })
  )
  const [state, setState] = useState<UndoManagerState>(undoManager.getState())

  useEffect(() => {
    // 订阅状态变化
    const unsubscribe = undoManager.addListener(newState => {
      setState(newState)
    })

    return unsubscribe
  }, [undoManager])

  const execute = useCallback(
    async (action: UndoableAction) => {
      await undoManager.execute(action)
    },
    [undoManager]
  )

  const undo = useCallback(async () => {
    return await undoManager.undo()
  }, [undoManager])

  const redo = useCallback(async () => {
    return await undoManager.redo()
  }, [undoManager])

  const clear = useCallback(() => {
    undoManager.clear()
  }, [undoManager])

  const createAction = useCallback(
    <T>(
      type: string,
      description: string,
      data: T,
      undoFn: () => void | Promise<void>,
      redoFn: () => void | Promise<void>
    ): UndoableAction<T> => {
      return createUndoableAction(type, description, data, undoFn, redoFn)
    },
    []
  )

  return {
    ...state,
    execute,
    undo,
    redo,
    clear,
    createAction,
    getUndoHistory: () => undoManager.getUndoHistory(),
    getRedoHistory: () => undoManager.getRedoHistory(),
  }
}

/**
 * 键盘快捷键支持
 */
export function useUndoKeyboardShortcuts(
  undo: () => void,
  redo: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z: 撤销
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === 'z' &&
        !event.shiftKey
      ) {
        event.preventDefault()
        undo()
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z: 重做
      // 或 Ctrl+Y / Cmd+Y: 重做
      if (
        ((event.ctrlKey || event.metaKey) &&
          event.key === 'z' &&
          event.shiftKey) ||
        ((event.ctrlKey || event.metaKey) && event.key === 'y')
      ) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [undo, redo, enabled])
}
