/**
 * 是否运行在桌面端（Tauri）环境。
 * 在浏览器里直接 `npm run dev` 调试时没有 Rust 端，依赖本地文件的功能需要降级处理。
 */
export function isDesktopApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}
