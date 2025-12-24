// 应用更新服务
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion?: string
  body?: string
  date?: string
}

export class UpdateService {
  private static checkingForUpdates = false

  /**
   * 检查应用更新
   */
  static async checkForUpdates(): Promise<UpdateInfo> {
    if (this.checkingForUpdates) {
      throw new Error('已在检查更新中')
    }

    try {
      this.checkingForUpdates = true
      const update = await check()

      if (update) {
        return {
          available: true,
          currentVersion: update.currentVersion,
          latestVersion: update.version,
          body: update.body,
          date: update.date,
        }
      }

      return {
        available: false,
        currentVersion: update?.currentVersion || '未知',
      }
    } catch (error) {
      console.error('检查更新失败:', error)
      throw error
    } finally {
      this.checkingForUpdates = false
    }
  }

  /**
   * 下载并安装更新
   */
  static async downloadAndInstall(
    onProgress?: (progress: number, total: number) => void
  ): Promise<void> {
    try {
      const update = await check()

      if (!update) {
        throw new Error('没有可用的更新')
      }

      // 下载更新
      let downloaded = 0
      let contentLength = 0

      await update.downloadAndInstall(event => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0
            console.log(`开始下载更新，大小: ${contentLength} bytes`)
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            if (onProgress && contentLength > 0) {
              onProgress(downloaded, contentLength)
            }
            break
          case 'Finished':
            console.log('更新下载完成')
            break
        }
      })

      // 重启应用以应用更新
      await relaunch()
    } catch (error) {
      console.error('下载安装更新失败:', error)
      throw error
    }
  }

  /**
   * 静默检查更新（启动时）
   */
  static async silentCheck(): Promise<boolean> {
    try {
      const update = await check()
      return !!update
    } catch (error) {
      console.error('静默检查更新失败:', error)
      return false
    }
  }
}
