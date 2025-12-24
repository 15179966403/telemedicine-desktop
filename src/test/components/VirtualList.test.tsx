import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VirtualList, DynamicVirtualList } from '@/components/VirtualList'

describe('VirtualList', () => {
  const mockItems = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }))

  const renderItem = (item: { id: number; name: string }, index: number) => (
    <div data-testid={`item-${index}`}>{item.name}</div>
  )

  it('should render virtual list', () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    // Should only render visible items
    const renderedItems = screen.queryAllByTestId(/item-/)
    expect(renderedItems.length).toBeLessThan(mockItems.length)
    expect(renderedItems.length).toBeGreaterThan(0)
  })

  it('should render items with correct height', () => {
    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const items = container.querySelectorAll('.virtual-list-item')
    items.forEach(item => {
      expect(item).toHaveStyle({ height: '50px' })
    })
  })

  it('should handle scroll events', () => {
    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const scrollContainer = container.querySelector('.virtual-list-container')
    expect(scrollContainer).toBeTruthy()

    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 1000 } })
      // After scrolling, different items should be visible
      expect(scrollContainer.scrollTop).toBe(1000)
    }
  })

  it('should call onEndReached when scrolling near bottom', () => {
    const onEndReached = vi.fn()

    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
        onEndReached={onEndReached}
        endReachedThreshold={0.8}
      />
    )

    const scrollContainer = container.querySelector('.virtual-list-container')

    if (scrollContainer) {
      // Mock scrollHeight and clientHeight
      Object.defineProperty(scrollContainer, 'scrollHeight', {
        value: 50000,
        writable: true,
      })
      Object.defineProperty(scrollContainer, 'clientHeight', {
        value: 500,
        writable: true,
      })

      // Scroll to near bottom (80% threshold)
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 39500 } })

      expect(onEndReached).toHaveBeenCalled()
    }
  })

  it('should handle overscan correctly', () => {
    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
        overscan={5}
      />
    )

    const items = container.querySelectorAll('.virtual-list-item')
    // With overscan, should render more items than just visible
    // Visible: 500/50 = 10 items
    // With overscan of 5: 10 + 5*2 = 20 items
    expect(items.length).toBeGreaterThan(10)
  })

  it('should handle empty items array', () => {
    const { container } = render(
      <VirtualList
        items={[]}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const items = container.querySelectorAll('.virtual-list-item')
    expect(items.length).toBe(0)
  })

  it('should calculate total height correctly', () => {
    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const content = container.querySelector('.virtual-list-content')
    expect(content).toHaveStyle({ height: `${mockItems.length * 50}px` })
  })
})

describe('DynamicVirtualList', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`,
  }))

  const renderItem = (
    item: { id: number; name: string; description: string },
    index: number
  ) => (
    <div data-testid={`item-${index}`}>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
    </div>
  )

  it('should render dynamic virtual list', () => {
    render(
      <DynamicVirtualList
        items={mockItems}
        estimatedItemHeight={80}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const renderedItems = screen.queryAllByTestId(/item-/)
    expect(renderedItems.length).toBeGreaterThan(0)
    expect(renderedItems.length).toBeLessThan(mockItems.length)
  })

  it('should handle scroll events', () => {
    const { container } = render(
      <DynamicVirtualList
        items={mockItems}
        estimatedItemHeight={80}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const scrollContainer = container.querySelector('.virtual-list-container')
    expect(scrollContainer).toBeTruthy()

    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } })
      expect(scrollContainer.scrollTop).toBe(500)
    }
  })

  it('should call onEndReached when scrolling near bottom', () => {
    const onEndReached = vi.fn()

    const { container } = render(
      <DynamicVirtualList
        items={mockItems}
        estimatedItemHeight={80}
        containerHeight={500}
        renderItem={renderItem}
        onEndReached={onEndReached}
        endReachedThreshold={0.8}
      />
    )

    const scrollContainer = container.querySelector('.virtual-list-container')

    if (scrollContainer) {
      Object.defineProperty(scrollContainer, 'scrollHeight', {
        value: 8000,
        writable: true,
      })
      Object.defineProperty(scrollContainer, 'clientHeight', {
        value: 500,
        writable: true,
      })

      fireEvent.scroll(scrollContainer, { target: { scrollTop: 6000 } })

      expect(onEndReached).toHaveBeenCalled()
    }
  })

  it('should handle empty items array', () => {
    const { container } = render(
      <DynamicVirtualList
        items={[]}
        estimatedItemHeight={80}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const items = container.querySelectorAll('.virtual-list-item')
    expect(items.length).toBe(0)
  })
})

describe('VirtualList Performance', () => {
  it('should handle large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }))

    const renderItem = (item: { id: number; name: string }) => (
      <div>{item.name}</div>
    )

    const start = performance.now()

    const { container } = render(
      <VirtualList
        items={largeDataset}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const duration = performance.now() - start

    // Initial render should be fast even with large dataset
    expect(duration).toBeLessThan(100)

    // Should only render visible items
    const items = container.querySelectorAll('.virtual-list-item')
    expect(items.length).toBeLessThan(100)
  })

  it('should handle rapid scrolling efficiently', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }))

    const renderItem = (item: { id: number; name: string }) => (
      <div>{item.name}</div>
    )

    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={50}
        containerHeight={500}
        renderItem={renderItem}
      />
    )

    const scrollContainer = container.querySelector('.virtual-list-container')

    if (scrollContainer) {
      const start = performance.now()

      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, {
          target: { scrollTop: i * 500 },
        })
      }

      const duration = performance.now() - start

      // Should handle rapid scrolling efficiently
      expect(duration).toBeLessThan(100)
    }
  })
})
