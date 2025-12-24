import React, { useRef, useState, useEffect, useCallback } from 'react'
import './VirtualList.css'

/**
 * 虚拟列表组件
 * Virtual list component for rendering large lists efficiently
 */

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number // 预渲染的额外项数
  onEndReached?: () => void
  endReachedThreshold?: number
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  // 计算可见范围
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    startIndex + visibleCount + overscan * 2
  )

  // 计算总高度
  const totalHeight = items.length * itemHeight

  // 计算偏移量
  const offsetY = startIndex * itemHeight

  // 处理滚动事件
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      setScrollTop(target.scrollTop)

      // 检查是否接近底部
      if (onEndReached) {
        const scrollPercentage =
          (target.scrollTop + target.clientHeight) / target.scrollHeight
        if (scrollPercentage >= endReachedThreshold) {
          onEndReached()
        }
      }
    },
    [onEndReached, endReachedThreshold]
  )

  // 获取可见项
  const visibleItems = items.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      className="virtual-list-container"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div
        className="virtual-list-content"
        style={{ height: totalHeight, position: 'relative' }}
      >
        <div
          className="virtual-list-items"
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              className="virtual-list-item"
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 动态高度虚拟列表组件
 * Virtual list with dynamic item heights
 */
interface DynamicVirtualListProps<T> {
  items: T[]
  estimatedItemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
}

export function DynamicVirtualList<T>({
  items,
  estimatedItemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  onEndReached,
  endReachedThreshold = 0.8,
}: DynamicVirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [scrollTop, setScrollTop] = useState(0)
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map())

  // 测量项高度
  const measureItem = useCallback((index: number, element: HTMLDivElement) => {
    if (element) {
      itemRefs.current.set(index, element)
      const height = element.getBoundingClientRect().height
      setItemHeights(prev => {
        const next = new Map(prev)
        next.set(index, height)
        return next
      })
    }
  }, [])

  // 计算项的位置
  const getItemOffset = useCallback(
    (index: number): number => {
      let offset = 0
      for (let i = 0; i < index; i++) {
        offset += itemHeights.get(i) || estimatedItemHeight
      }
      return offset
    },
    [itemHeights, estimatedItemHeight]
  )

  // 计算总高度
  const totalHeight = items.reduce((sum, _, index) => {
    return sum + (itemHeights.get(index) || estimatedItemHeight)
  }, 0)

  // 查找可见范围
  const findVisibleRange = useCallback(() => {
    let startIndex = 0
    let endIndex = items.length
    let currentOffset = 0

    // 找到起始索引
    for (let i = 0; i < items.length; i++) {
      const height = itemHeights.get(i) || estimatedItemHeight
      if (currentOffset + height > scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
      currentOffset += height
    }

    // 找到结束索引
    currentOffset = getItemOffset(startIndex)
    for (let i = startIndex; i < items.length; i++) {
      const height = itemHeights.get(i) || estimatedItemHeight
      if (currentOffset > scrollTop + containerHeight) {
        endIndex = Math.min(items.length, i + overscan)
        break
      }
      currentOffset += height
    }

    return { startIndex, endIndex }
  }, [
    items.length,
    itemHeights,
    estimatedItemHeight,
    scrollTop,
    containerHeight,
    overscan,
    getItemOffset,
  ])

  const { startIndex, endIndex } = findVisibleRange()
  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = getItemOffset(startIndex)

  // 处理滚动事件
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      setScrollTop(target.scrollTop)

      // 检查是否接近底部
      if (onEndReached) {
        const scrollPercentage =
          (target.scrollTop + target.clientHeight) / target.scrollHeight
        if (scrollPercentage >= endReachedThreshold) {
          onEndReached()
        }
      }
    },
    [onEndReached, endReachedThreshold]
  )

  return (
    <div
      ref={containerRef}
      className="virtual-list-container"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div
        className="virtual-list-content"
        style={{ height: totalHeight, position: 'relative' }}
      >
        <div
          className="virtual-list-items"
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index
            return (
              <div
                key={actualIndex}
                ref={el => el && measureItem(actualIndex, el)}
                className="virtual-list-item"
              >
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
