import { invoke } from '@tauri-apps/api/core'

export interface ReportStorageConfig {
  rootPath: string
  diskFreeBytes: number
  diskFreeGb: number
  isCustom: boolean
}

export interface SingleReportFileInfo {
  url: string
  fileName: string
  localPath: string
  exists: boolean
  fileSize: number
  isOutdated: boolean
  modifiedTime?: string
}

export interface ReportStatusResult {
  customerDir: string
  reportDir: string
  reportDirExists: boolean
  files: SingleReportFileInfo[]
  allDownloaded: boolean
  hasUpdates: boolean
}

export interface CheckReportStatusParams {
  customerName: string
  mobile: string
  customerId: string | number
  reportId: string | number
  reportDate?: string
  medicalOrg?: string
  fileUrls: string[]
  remoteUpdateTime?: string
}

export interface DownloadReportFileParams {
  customerName: string
  mobile: string
  customerId: string | number
  reportId: string | number
  reportDate?: string
  medicalOrg?: string
  fileUrl: string
  customFileName?: string
}

export interface DownloadReportBatchParams {
  customerName: string
  mobile: string
  customerId: string | number
  reportId: string | number
  reportDate?: string
  medicalOrg?: string
  fileUrls: string[]
}

export interface DownloadResult {
  success: boolean
  url: string
  localPath: string
  fileName: string
  fileSize: number
  error?: string
}

export interface CleanAllResult {
  cleanedItemsCount: number
  config: ReportStorageConfig
}

export class ReportFileService {
  private static instance: ReportFileService

  static getInstance(): ReportFileService {
    if (!ReportFileService.instance) {
      ReportFileService.instance = new ReportFileService()
    }
    return ReportFileService.instance
  }

  /**
   * 1. 获取当前报告文件存储根目录及磁盘剩余空间
   */
  async getStorageConfig(): Promise<ReportStorageConfig> {
    try {
      return await invoke<ReportStorageConfig>('get_report_storage_dir')
    } catch (error) {
      console.error('get_report_storage_dir failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 2. 设置并保存新的报告文件存储根目录
   */
  async setStorageConfig(newPath: string): Promise<ReportStorageConfig> {
    try {
      return await invoke<ReportStorageConfig>('set_report_storage_dir', { newPath })
    } catch (error) {
      console.error('set_report_storage_dir failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 3. 调起系统原生文件夹选择对话框
   */
  async selectFolderDialog(): Promise<string | null> {
    try {
      return await invoke<string | null>('select_report_folder_dialog')
    } catch (error) {
      console.error('select_report_folder_dialog failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 4. 检查单份体检报告在本地的下载与更新状态
   */
  async checkReportStatus(params: CheckReportStatusParams): Promise<ReportStatusResult> {
    try {
      return await invoke<ReportStatusResult>('check_report_file_status', {
        params: {
          ...params,
          customerId: String(params.customerId),
          reportId: String(params.reportId),
        },
      })
    } catch (error) {
      console.error('check_report_file_status failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 5. 下载单个附件文件到本地规范目录
   */
  async downloadSingleFile(params: DownloadReportFileParams): Promise<DownloadResult> {
    try {
      return await invoke<DownloadResult>('download_single_report_file', {
        params: {
          ...params,
          customerId: String(params.customerId),
          reportId: String(params.reportId),
        },
      })
    } catch (error) {
      console.error('download_single_report_file failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 6. 批量下载某份报告下的全部附件
   */
  async downloadBatchFiles(params: DownloadReportBatchParams): Promise<DownloadResult[]> {
    try {
      return await invoke<DownloadResult[]>('download_batch_report_files', {
        params: {
          ...params,
          customerId: String(params.customerId),
          reportId: String(params.reportId),
        },
      })
    } catch (error) {
      console.error('download_batch_report_files failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 7. 使用 Windows 默认关联程序打开本地文件
   */
  async openLocalFile(filePath: string): Promise<void> {
    try {
      await invoke('open_report_local_file', { filePath })
    } catch (error) {
      console.error('open_report_local_file failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 8. 在 Windows 资源管理器中打开文件夹并选中文件
   */
  async openLocalFolder(folderPath: string, selectFile?: string): Promise<void> {
    try {
      await invoke('open_report_local_folder', {
        folderPath,
        selectFile,
      })
    } catch (error) {
      console.error('open_report_local_folder failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 9. 清理单份体检报告在本地磁盘的下载文件与目录
   */
  async cleanSingleReportFiles(params: CheckReportStatusParams): Promise<boolean> {
    try {
      return await invoke<boolean>('clean_single_report_files', {
        params: {
          ...params,
          customerId: String(params.customerId),
          reportId: String(params.reportId),
        },
      })
    } catch (error) {
      console.error('clean_single_report_files failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 10. 清理某个客户名下的所有已归档本地报告目录与文件
   */
  async cleanCustomerReportFiles(
    customerName: string,
    mobile: string,
    customerId: string | number
  ): Promise<boolean> {
    try {
      return await invoke<boolean>('clean_customer_report_files', {
        customerName,
        mobile,
        customerId: String(customerId),
      })
    } catch (error) {
      console.error('clean_customer_report_files failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 11. 一键清理存储根目录下的所有本地报告缓存与文件（彻底擦除磁盘数据）
   */
  async cleanAllReportFiles(): Promise<CleanAllResult> {
    try {
      return await invoke<CleanAllResult>('clean_all_report_files')
    } catch (error) {
      console.error('clean_all_report_files failed:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }
}
