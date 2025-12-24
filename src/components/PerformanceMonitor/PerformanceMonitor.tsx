import React, { useState, useEffect } from 'react'
import { Card, Statistic, Row, Col, Progress, Button, Space } from 'antd'
import {
  MemoryMonitor,
  CacheManager,
  PerformanceMonitor as PerfMonitor,
} from '@/utils/performance'
import './PerformanceMonitor.css'

/**
 * 性能监控面板组件
 * Performance monitoring dashboard component
 */
export const PerformanceMonitor: React.FC = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
    percentage: number
  } | null>(null)

  const [cacheStats, setCacheStats] = useState({
    size: 0,
    maxSize: 0,
    count: 0,
    percentage: 0,
  })

  const [performanceStats, setPerformanceStats] = useState<
    Array<{
      key: string
      count: number
      average: number
      min: number
      max: number
    }>
  >([])

  useEffect(() => {
    const memoryMonitor = MemoryMonitor.getInstance()
    const cacheManager = CacheManager.getInstance()
    const perfMonitor = PerfMonitor.getInstance()

    // 更新内存信息
    const updateMemoryInfo = () => {
      const usage = memoryMonitor.getCurrentUsage()
      if (usage) {
        setMemoryInfo(usage)
      }
    }

    // 更新缓存统计
    const updateCacheStats = () => {
      const stats = cacheManager.getStats()
      setCacheStats(stats)
    }

    // 更新性能统计
    const updatePerformanceStats = () => {
      const keys = perfMonitor.getKeys()
      const stats = keys
        .map(key => {
          const stat = perfMonitor.getStats(key)
          return stat ? { key, ...stat } : null
        })
        .filter(s => s !== null) as Array<{
        key: string
        count: number
        average: number
        min: number
        max: number
      }>

      setPerformanceStats(stats)
    }

    // 初始更新
    updateMemoryInfo()
    updateCacheStats()
    updatePerformanceStats()

    // 定期更新
    const interval = setInterval(() => {
      updateMemoryInfo()
      updateCacheStats()
      updatePerformanceStats()
    }, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const handleClearCache = () => {
    const cacheManager = CacheManager.getInstance()
    cacheManager.clear()
    setCacheStats(cacheManager.getStats())
  }

  const handleClearPerformanceStats = () => {
    const perfMonitor = PerfMonitor.getInstance()
    perfMonitor.clear()
    setPerformanceStats([])
  }

  return (
    <div className="performance-monitor">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 内存使用情况 */}
        <Card title="内存使用" size="small">
          {memoryInfo ? (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="已使用"
                    value={formatBytes(memoryInfo.usedJSHeapSize)}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="总计"
                    value={formatBytes(memoryInfo.totalJSHeapSize)}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="限制"
                    value={formatBytes(memoryInfo.jsHeapSizeLimit)}
                  />
                </Col>
              </Row>
              <Progress
                percent={Math.round(memoryInfo.percentage)}
                status={memoryInfo.percentage > 80 ? 'exception' : 'normal'}
                style={{ marginTop: 16 }}
              />
            </>
          ) : (
            <p>内存信息不可用</p>
          )}
        </Card>

        {/* 缓存统计 */}
        <Card
          title="缓存统计"
          size="small"
          extra={
            <Button size="small" onClick={handleClearCache}>
              清空缓存
            </Button>
          }
        >
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="缓存项数" value={cacheStats.count} />
            </Col>
            <Col span={8}>
              <Statistic
                title="缓存大小"
                value={formatBytes(cacheStats.size)}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="最大容量"
                value={formatBytes(cacheStats.maxSize)}
              />
            </Col>
          </Row>
          <Progress
            percent={Math.round(cacheStats.percentage)}
            status={cacheStats.percentage > 80 ? 'exception' : 'normal'}
            style={{ marginTop: 16 }}
          />
        </Card>

        {/* 性能统计 */}
        <Card
          title="性能统计"
          size="small"
          extra={
            <Button size="small" onClick={handleClearPerformanceStats}>
              清空统计
            </Button>
          }
        >
          {performanceStats.length > 0 ? (
            <div className="performance-stats-list">
              {performanceStats.map(stat => (
                <div key={stat.key} className="performance-stat-item">
                  <div className="stat-name">{stat.key}</div>
                  <Row gutter={8}>
                    <Col span={6}>
                      <Statistic
                        title="次数"
                        value={stat.count}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="平均"
                        value={`${stat.average.toFixed(2)}ms`}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="最小"
                        value={`${stat.min.toFixed(2)}ms`}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="最大"
                        value={`${stat.max.toFixed(2)}ms`}
                        valueStyle={{ fontSize: 14 }}
                      />
                    </Col>
                  </Row>
                </div>
              ))}
            </div>
          ) : (
            <p>暂无性能统计数据</p>
          )}
        </Card>
      </Space>
    </div>
  )
}
