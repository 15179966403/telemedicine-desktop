import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StartupOptimizer } from './utils/startupOptimizer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { crashReporter } from './services/crashReporter'

// 预加载关键资源
StartupOptimizer.preloadCriticalResources().then(() => {
  // 渲染应用
  const renderStart = Date.now()
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )

  StartupOptimizer.recordMetric('uiRenderTime', Date.now() - renderStart)

  // 延迟加载非关键资源
  StartupOptimizer.deferNonCriticalResources()

  // 完成启动
  StartupOptimizer.finishStartup()

  // 记录应用启动
  crashReporter.recordAction('应用启动完成')
})
