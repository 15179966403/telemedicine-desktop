import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileUploadComponent } from '../../components/FileUpload/FileUploadComponent'
import { FileService } from '../../services/fileService'

// Mock the FileService
vi.mock('../../services/fileService')

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('FileUploadComponent', () => {
  let mockFileService: any
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    mockFileService = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      downloadFile: vi.fn(),
      getFileIcon: vi.fn().mockReturnValue('📎'),
      formatFileSize: vi.fn().mockImplementation(size => `${size} B`),
    }

    vi.mocked(FileService.getInstance).mockReturnValue(mockFileService)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render upload area correctly', () => {
    // Act
    render(<FileUploadComponent />)

    // Assert
    expect(screen.getByText('点击或拖拽文件到此区域上传')).toBeInTheDocument()
    expect(screen.getByText(/支持单个或批量上传/)).toBeInTheDocument()
  })

  it('should show custom upload hint with props', () => {
    // Act
    render(<FileUploadComponent maxFiles={5} maxFileSize={25} />)

    // Assert
    expect(
      screen.getByText(/最多 5 个文件，单个文件不超过 25MB/)
    ).toBeInTheDocument()
  })

  it('should call onFileUploaded when file upload succeeds', async () => {
    // Arrange
    const mockFileInfo = {
      id: 'file-123',
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      url: 'https://example.com/test.txt',
      uploadedAt: new Date(),
    }

    const onFileUploaded = vi.fn()
    mockFileService.uploadFile.mockResolvedValue(mockFileInfo)

    render(<FileUploadComponent onFileUploaded={onFileUploaded} />)

    // Act
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file)
    }

    // Assert
    await waitFor(() => {
      expect(mockFileService.uploadFile).toHaveBeenCalledWith(
        file,
        expect.any(Function)
      )
      expect(onFileUploaded).toHaveBeenCalledWith(mockFileInfo)
    })
  })

  it('should show error message when file upload fails', async () => {
    // Arrange
    const uploadError = new Error('Upload failed')
    mockFileService.uploadFile.mockRejectedValue(uploadError)

    render(<FileUploadComponent />)

    // Act
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file)
    }

    // Assert
    await waitFor(() => {
      expect(mockFileService.uploadFile).toHaveBeenCalled()
    })
  })

  it('should reject files that exceed size limit', async () => {
    // Arrange
    render(<FileUploadComponent maxFileSize={1} />) // 1MB limit

    // Act
    const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.txt', {
      type: 'text/plain',
    })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, largeFile)
    }

    // Assert
    expect(mockFileService.uploadFile).not.toHaveBeenCalled()
  })

  it('should reject files with unsupported types', async () => {
    // Arrange
    render(<FileUploadComponent allowedTypes={['image/*']} />)

    // Act
    const textFile = new File(['content'], 'test.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, textFile)
    }

    // Assert
    expect(mockFileService.uploadFile).not.toHaveBeenCalled()
  })

  it('should reject files when max file limit is reached', async () => {
    // Arrange
    const mockFileInfo = {
      id: 'file-123',
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      url: 'https://example.com/test.txt',
      uploadedAt: new Date(),
    }

    mockFileService.uploadFile.mockResolvedValue(mockFileInfo)

    render(<FileUploadComponent maxFiles={1} />)

    // Upload first file
    const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file1)
    }

    await waitFor(() => {
      expect(mockFileService.uploadFile).toHaveBeenCalledTimes(1)
    })

    // Try to upload second file
    const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' })

    if (input) {
      await user.upload(input, file2)
    }

    // Assert - should still be only 1 call
    expect(mockFileService.uploadFile).toHaveBeenCalledTimes(1)
  })

  it('should show uploaded files list', async () => {
    // Arrange
    const mockFileInfo = {
      id: 'file-123',
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      url: 'https://example.com/test.txt',
      uploadedAt: new Date(),
    }

    mockFileService.uploadFile.mockResolvedValue(mockFileInfo)

    render(<FileUploadComponent />)

    // Act
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file)
    }

    // Assert
    await waitFor(() => {
      expect(screen.getByText('已上传文件')).toBeInTheDocument()
      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })
  })

  it('should delete file when delete button is clicked', async () => {
    // Arrange
    const mockFileInfo = {
      id: 'file-123',
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      url: 'https://example.com/test.txt',
      uploadedAt: new Date(),
    }

    const onFileDeleted = vi.fn()
    mockFileService.uploadFile.mockResolvedValue(mockFileInfo)
    mockFileService.deleteFile.mockResolvedValue(undefined)

    render(<FileUploadComponent onFileDeleted={onFileDeleted} />)

    // Upload file first
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file)
    }

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })

    // Act - click delete button
    const deleteButton = screen.getByRole('button', { name: /删除/ })
    await user.click(deleteButton)

    // Assert
    await waitFor(() => {
      expect(mockFileService.deleteFile).toHaveBeenCalledWith('file-123')
      expect(onFileDeleted).toHaveBeenCalledWith('file-123')
    })
  })

  it('should download file when download button is clicked', async () => {
    // Arrange
    const mockFileInfo = {
      id: 'file-123',
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      url: 'https://example.com/test.txt',
      uploadedAt: new Date(),
    }

    mockFileService.uploadFile.mockResolvedValue(mockFileInfo)
    mockFileService.downloadFile.mockResolvedValue('/local/path/test.txt')

    render(<FileUploadComponent />)

    // Upload file first
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const input = screen
      .getByRole('button', { name: /点击或拖拽文件到此区域上传/ })
      .querySelector('input[type="file"]')

    if (input) {
      await user.upload(input, file)
    }

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })

    // Act - click download button
    const downloadButton = screen.getByRole('button', { name: /下载/ })
    await user.click(downloadButton)

    // Assert
    await waitFor(() => {
      expect(mockFileService.downloadFile).toHaveBeenCalledWith(
        'https://example.com/test.txt',
        'test.txt'
      )
    })
  })

  it('should be disabled when disabled prop is true', () => {
    // Act
    render(<FileUploadComponent disabled={true} />)

    // Assert
    const uploadArea = screen.getByRole('button', {
      name: /点击或拖拽文件到此区域上传/,
    })
    expect(uploadArea).toHaveClass('ant-upload-disabled')
  })
})
