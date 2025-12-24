/**
 * 撤销管理器测试
 * Undo manager tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  UndoManager,
  createUndoableAction,
  globalUndoManager,
} from '@/utils/undoManager'

describe('UndoManager', () => {
  let undoManager: UndoManager

  beforeEach(() => {
    undoManager = new UndoManager({ maxHistorySize: 10 })
  })

  describe('Basic Operations', () => {
    it('should execute an action', async () => {
      const redoFn = vi.fn()
      const undoFn = vi.fn()

      const action = createUndoableAction(
        'test',
        'Test action',
        { value: 1 },
        undoFn,
        redoFn
      )

      await undoManager.execute(action)

      expect(redoFn).toHaveBeenCalled()
      expect(undoManager.canUndo()).toBe(true)
      expect(undoManager.canRedo()).toBe(false)
    })

    it('should undo an action', async () => {
      const redoFn = vi.fn()
      const undoFn = vi.fn()

      const action = createUndoableAction(
        'test',
        'Test action',
        { value: 1 },
        undoFn,
        redoFn
      )

      await undoManager.execute(action)
      const result = await undoManager.undo()

      expect(result).toBe(true)
      expect(undoFn).toHaveBeenCalled()
      expect(undoManager.canUndo()).toBe(false)
      expect(undoManager.canRedo()).toBe(true)
    })

    it('should redo an action', async () => {
      const redoFn = vi.fn()
      const undoFn = vi.fn()

      const action = createUndoableAction(
        'test',
        'Test action',
        { value: 1 },
        undoFn,
        redoFn
      )

      await undoManager.execute(action)
      await undoManager.undo()

      redoFn.mockClear()
      const result = await undoManager.redo()

      expect(result).toBe(true)
      expect(redoFn).toHaveBeenCalled()
      expect(undoManager.canUndo()).toBe(true)
      expect(undoManager.canRedo()).toBe(false)
    })

    it('should not undo when stack is empty', async () => {
      const result = await undoManager.undo()
      expect(result).toBe(false)
    })

    it('should not redo when stack is empty', async () => {
      const result = await undoManager.redo()
      expect(result).toBe(false)
    })
  })

  describe('Stack Management', () => {
    it('should clear redo stack on new action', async () => {
      const action1 = createUndoableAction(
        'test',
        'Action 1',
        {},
        vi.fn(),
        vi.fn()
      )
      const action2 = createUndoableAction(
        'test',
        'Action 2',
        {},
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action1)
      await undoManager.undo()

      expect(undoManager.canRedo()).toBe(true)

      await undoManager.execute(action2)

      expect(undoManager.canRedo()).toBe(false)
    })

    it('should respect max history size', async () => {
      const manager = new UndoManager({ maxHistorySize: 3 })

      for (let i = 0; i < 5; i++) {
        const action = createUndoableAction(
          'test',
          `Action ${i}`,
          { value: i },
          vi.fn(),
          vi.fn()
        )
        await manager.execute(action)
      }

      expect(manager.getUndoStackSize()).toBe(3)
    })

    it('should get correct stack sizes', async () => {
      const action = createUndoableAction(
        'test',
        'Action',
        {},
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action)
      expect(undoManager.getUndoStackSize()).toBe(1)
      expect(undoManager.getRedoStackSize()).toBe(0)

      await undoManager.undo()
      expect(undoManager.getUndoStackSize()).toBe(0)
      expect(undoManager.getRedoStackSize()).toBe(1)
    })

    it('should clear all history', async () => {
      const action = createUndoableAction(
        'test',
        'Action',
        {},
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action)
      undoManager.clear()

      expect(undoManager.canUndo()).toBe(false)
      expect(undoManager.canRedo()).toBe(false)
      expect(undoManager.getUndoStackSize()).toBe(0)
      expect(undoManager.getRedoStackSize()).toBe(0)
    })
  })

  describe('Action History', () => {
    it('should get last undo action', async () => {
      const action = createUndoableAction(
        'test',
        'Test action',
        { value: 1 },
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action)

      const lastAction = undoManager.getLastUndoAction()
      expect(lastAction).toBeDefined()
      expect(lastAction?.description).toBe('Test action')
    })

    it('should get last redo action', async () => {
      const action = createUndoableAction(
        'test',
        'Test action',
        { value: 1 },
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action)
      await undoManager.undo()

      const lastAction = undoManager.getLastRedoAction()
      expect(lastAction).toBeDefined()
      expect(lastAction?.description).toBe('Test action')
    })

    it('should get undo history', async () => {
      const action1 = createUndoableAction(
        'test',
        'Action 1',
        {},
        vi.fn(),
        vi.fn()
      )
      const action2 = createUndoableAction(
        'test',
        'Action 2',
        {},
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action1)
      await undoManager.execute(action2)

      const history = undoManager.getUndoHistory()
      expect(history).toHaveLength(2)
      expect(history[0].description).toBe('Action 1')
      expect(history[1].description).toBe('Action 2')
    })

    it('should get redo history', async () => {
      const action1 = createUndoableAction(
        'test',
        'Action 1',
        {},
        vi.fn(),
        vi.fn()
      )
      const action2 = createUndoableAction(
        'test',
        'Action 2',
        {},
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action1)
      await undoManager.execute(action2)
      await undoManager.undo()
      await undoManager.undo()

      const history = undoManager.getRedoHistory()
      expect(history).toHaveLength(2)
    })
  })

  describe('State Management', () => {
    it('should get current state', async () => {
      const action = createUndoableAction(
        'test',
        'Action',
        {},
        vi.fn(),
        vi.fn()
      )

      await undoManager.execute(action)

      const state = undoManager.getState()
      expect(state.canUndo).toBe(true)
      expect(state.canRedo).toBe(false)
      expect(state.undoStackSize).toBe(1)
      expect(state.redoStackSize).toBe(0)
      expect(state.lastUndoAction).toBeDefined()
    })

    it('should notify listeners on state change', async () => {
      const listener = vi.fn()
      undoManager.addListener(listener)

      const action = createUndoableAction(
        'test',
        'Action',
        {},
        vi.fn(),
        vi.fn()
      )
      await undoManager.execute(action)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          canUndo: true,
          canRedo: false,
        })
      )
    })

    it('should remove listener', async () => {
      const listener = vi.fn()
      const unsubscribe = undoManager.addListener(listener)

      unsubscribe()

      const action = createUndoableAction(
        'test',
        'Action',
        {},
        vi.fn(),
        vi.fn()
      )
      await undoManager.execute(action)

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle undo errors', async () => {
      const undoFn = vi.fn().mockRejectedValue(new Error('Undo failed'))
      const action = createUndoableAction('test', 'Action', {}, undoFn, vi.fn())

      await undoManager.execute(action)

      await expect(undoManager.undo()).rejects.toThrow('Undo failed')

      // Action should remain in undo stack
      expect(undoManager.canUndo()).toBe(true)
    })

    it('should handle redo errors', async () => {
      const redoFn = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('Redo failed'))
      const action = createUndoableAction('test', 'Action', {}, vi.fn(), redoFn)

      await undoManager.execute(action)
      await undoManager.undo()

      await expect(undoManager.redo()).rejects.toThrow('Redo failed')

      // Action should remain in redo stack
      expect(undoManager.canRedo()).toBe(true)
    })

    it('should handle execute errors', async () => {
      const redoFn = vi.fn().mockRejectedValue(new Error('Execute failed'))
      const action = createUndoableAction('test', 'Action', {}, vi.fn(), redoFn)

      await expect(undoManager.execute(action)).rejects.toThrow(
        'Execute failed'
      )
    })
  })

  describe('Multiple Actions', () => {
    it('should handle multiple undo/redo operations', async () => {
      const actions = []
      for (let i = 0; i < 3; i++) {
        const action = createUndoableAction(
          'test',
          `Action ${i}`,
          { value: i },
          vi.fn(),
          vi.fn()
        )
        actions.push(action)
        await undoManager.execute(action)
      }

      expect(undoManager.getUndoStackSize()).toBe(3)

      await undoManager.undo()
      await undoManager.undo()

      expect(undoManager.getUndoStackSize()).toBe(1)
      expect(undoManager.getRedoStackSize()).toBe(2)

      await undoManager.redo()

      expect(undoManager.getUndoStackSize()).toBe(2)
      expect(undoManager.getRedoStackSize()).toBe(1)
    })
  })

  describe('createUndoableAction', () => {
    it('should create action with correct properties', () => {
      const undoFn = vi.fn()
      const redoFn = vi.fn()
      const data = { value: 42 }

      const action = createUndoableAction(
        'test-type',
        'Test description',
        data,
        undoFn,
        redoFn
      )

      expect(action.id).toBeDefined()
      expect(action.type).toBe('test-type')
      expect(action.description).toBe('Test description')
      expect(action.data).toEqual(data)
      expect(action.undo).toBe(undoFn)
      expect(action.redo).toBe(redoFn)
      expect(action.timestamp).toBeInstanceOf(Date)
    })

    it('should generate unique IDs', () => {
      const action1 = createUndoableAction(
        'test',
        'Action 1',
        {},
        vi.fn(),
        vi.fn()
      )
      const action2 = createUndoableAction(
        'test',
        'Action 2',
        {},
        vi.fn(),
        vi.fn()
      )

      expect(action1.id).not.toBe(action2.id)
    })
  })

  describe('Global Undo Manager', () => {
    it('should provide global instance', () => {
      expect(globalUndoManager).toBeInstanceOf(UndoManager)
    })
  })
})
