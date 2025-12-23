import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWindowStore } from '@/stores/windowStore'

// Mock console.log to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('WindowStore', () => {
  beforeEach(() => {
    // Reset store state
    useWindowStore.setState({
      windows: new Map(),
      activeWindow: null,
      maxWindows: 5,
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useWindowStore.getState()

      expect(state.windows).toBeInstanceOf(Map)
      expect(state.windows.size).toBe(0)
      expect(state.activeWindow).toBeNull()
      expect(state.maxWindows).toBe(5)
    })
  })

  describe('Window Creation', () => {
    it('should create a new window', async () => {
      const { createWindow } = useWindowStore.getState()
      const windowId = await createWindow('consultation', {
        patientName: '张三',
      })

      const state = useWindowStore.getState()
      expect(state.windows.size).toBe(1)
      expect(state.activeWindow).toBe(windowId)

      const window = state.windows.get(windowId)
      expect(window?.type).toBe('consultation')
      expect(window?.title).toBe('问诊 - 张三')
      expect(window?.data).toEqual({ patientName: '张三' })
    })

    it('should generate unique window IDs', async () => {
      const { createWindow } = useWindowStore.getState()

      const windowId1 = await createWindow('consultation')
      const windowId2 = await createWindow('consultation')

      expect(windowId1).not.toBe(windowId2)
      expect(useWindowStore.getState().windows.size).toBe(2)
    })

    it('should respect maximum window limit', async () => {
      const { createWindow } = useWindowStore.getState()

      // Create maximum number of windows
      for (let i = 0; i < 5; i++) {
        await createWindow('consultation')
      }

      // Try to create one more
      await expect(createWindow('consultation')).rejects.toThrow(
        '最多只能同时打开 5 个窗口'
      )

      expect(useWindowStore.getState().windows.size).toBe(5)
    })

    it('should generate correct titles for different window types', async () => {
      const { createWindow } = useWindowStore.getState()

      const mainWindowId = await createWindow('main')
      const consultationWindowId = await createWindow('consultation', {
        patientName: '李四',
      })
      const patientWindowId = await createWindow('patient_detail', {
        patientName: '王五',
      })
      const settingsWindowId = await createWindow('settings')

      const state = useWindowStore.getState()
      expect(state.windows.get(mainWindowId)?.title).toBe('互联网医院 - 工作台')
      expect(state.windows.get(consultationWindowId)?.title).toBe('问诊 - 李四')
      expect(state.windows.get(patientWindowId)?.title).toBe('患者详情 - 王五')
      expect(state.windows.get(settingsWindowId)?.title).toBe('设置')
    })
  })

  describe('Window Management', () => {
    let windowId1: string
    let windowId2: string

    beforeEach(async () => {
      const { createWindow } = useWindowStore.getState()
      windowId1 = await createWindow('consultation', { patientName: '张三' })
      windowId2 = await createWindow('patient_detail', { patientName: '李四' })
    })

    it('should close window', () => {
      const { closeWindow } = useWindowStore.getState()
      closeWindow(windowId1)

      const state = useWindowStore.getState()
      expect(state.windows.size).toBe(1)
      expect(state.windows.has(windowId1)).toBe(false)
      expect(state.windows.has(windowId2)).toBe(true)
    })

    it('should update active window when closing active window', () => {
      useWindowStore.setState({ activeWindow: windowId1 })

      const { closeWindow } = useWindowStore.getState()
      closeWindow(windowId1)

      const state = useWindowStore.getState()
      expect(state.activeWindow).toBe(windowId2) // Should switch to remaining window
    })

    it('should clear active window when closing last window', () => {
      const { closeWindow } = useWindowStore.getState()
      closeWindow(windowId1)
      closeWindow(windowId2)

      const state = useWindowStore.getState()
      expect(state.activeWindow).toBeNull()
      expect(state.windows.size).toBe(0)
    })

    it('should focus window', () => {
      const { focusWindow } = useWindowStore.getState()
      focusWindow(windowId2)

      expect(useWindowStore.getState().activeWindow).toBe(windowId2)
    })

    it('should not focus non-existent window', () => {
      const originalActiveWindow = useWindowStore.getState().activeWindow

      const { focusWindow } = useWindowStore.getState()
      focusWindow('non-existent-id')

      expect(useWindowStore.getState().activeWindow).toBe(originalActiveWindow)
    })

    it('should update window', () => {
      const updates = { title: 'Updated Title', data: { newData: 'test' } }

      const { updateWindow } = useWindowStore.getState()
      updateWindow(windowId1, updates)

      const state = useWindowStore.getState()
      const window = state.windows.get(windowId1)
      expect(window?.title).toBe('Updated Title')
      expect(window?.data).toEqual({ newData: 'test' })
      expect(window?.type).toBe('consultation') // unchanged
    })

    it('should not update non-existent window', () => {
      const originalSize = useWindowStore.getState().windows.size

      const { updateWindow } = useWindowStore.getState()
      updateWindow('non-existent-id', { title: 'Test' })

      expect(useWindowStore.getState().windows.size).toBe(originalSize)
    })
  })

  describe('Window Queries', () => {
    let windowId1: string
    let windowId2: string

    beforeEach(async () => {
      const { createWindow } = useWindowStore.getState()
      windowId1 = await createWindow('consultation', { patientName: '张三' })
      windowId2 = await createWindow('patient_detail', { patientName: '李四' })
    })

    it('should get window by ID', () => {
      const { getWindow } = useWindowStore.getState()
      const window = getWindow(windowId1)

      expect(window?.id).toBe(windowId1)
      expect(window?.type).toBe('consultation')
      expect(window?.data).toEqual({ patientName: '张三' })
    })

    it('should return undefined for non-existent window', () => {
      const { getWindow } = useWindowStore.getState()
      const window = getWindow('non-existent-id')

      expect(window).toBeUndefined()
    })

    it('should get all windows', () => {
      const { getAllWindows } = useWindowStore.getState()
      const windows = getAllWindows()

      expect(windows).toHaveLength(2)
      expect(windows.some(w => w.id === windowId1)).toBe(true)
      expect(windows.some(w => w.id === windowId2)).toBe(true)
    })

    it('should return empty array when no windows exist', () => {
      useWindowStore.setState({ windows: new Map() })

      const { getAllWindows } = useWindowStore.getState()
      const windows = getAllWindows()

      expect(windows).toEqual([])
    })
  })

  describe('Active Window Management', () => {
    it('should set active window', () => {
      const { setActiveWindow } = useWindowStore.getState()
      setActiveWindow('test-window-id')

      expect(useWindowStore.getState().activeWindow).toBe('test-window-id')
    })

    it('should clear active window', () => {
      useWindowStore.setState({ activeWindow: 'some-window-id' })

      const { setActiveWindow } = useWindowStore.getState()
      setActiveWindow(null)

      expect(useWindowStore.getState().activeWindow).toBeNull()
    })
  })
})
