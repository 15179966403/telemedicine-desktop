/**
 * 数据验证测试
 * Data validation tests
 */

import { describe, it, expect } from 'vitest'
import { DataValidator } from '../utils/dataValidation'
import {
  LoginCredentials,
  Patient,
  SendMessageRequest,
  PatientQuery,
  WindowConfig,
} from '../types'

describe('DataValidator', () => {
  describe('validateLoginCredentials', () => {
    it('should validate password login credentials', () => {
      const validCredentials: LoginCredentials = {
        type: 'password',
        username: 'testuser',
        password: 'password123',
      }

      const result = DataValidator.validateLoginCredentials(validCredentials)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject password login with missing username', () => {
      const invalidCredentials: LoginCredentials = {
        type: 'password',
        password: 'password123',
      }

      const result = DataValidator.validateLoginCredentials(invalidCredentials)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('username')
      expect(result.errors[0].code).toBe('REQUIRED')
    })

    it('should reject password login with short password', () => {
      const invalidCredentials: LoginCredentials = {
        type: 'password',
        username: 'testuser',
        password: '123',
      }

      const result = DataValidator.validateLoginCredentials(invalidCredentials)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('password')
      expect(result.errors[0].code).toBe('MIN_LENGTH')
    })

    it('should validate SMS login credentials', () => {
      const validCredentials: LoginCredentials = {
        type: 'sms',
        phone: '13812345678',
        smsCode: '123456',
      }

      const result = DataValidator.validateLoginCredentials(validCredentials)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject SMS login with invalid phone', () => {
      const invalidCredentials: LoginCredentials = {
        type: 'sms',
        phone: '12345',
        smsCode: '123456',
      }

      const result = DataValidator.validateLoginCredentials(invalidCredentials)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('phone')
      expect(result.errors[0].code).toBe('INVALID_FORMAT')
    })

    it('should reject SMS login with invalid SMS code', () => {
      const invalidCredentials: LoginCredentials = {
        type: 'sms',
        phone: '13812345678',
        smsCode: '123',
      }

      const result = DataValidator.validateLoginCredentials(invalidCredentials)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('smsCode')
      expect(result.errors[0].code).toBe('INVALID_FORMAT')
    })

    it('should validate realname login credentials', () => {
      const validCredentials: LoginCredentials = {
        type: 'realname',
        idCard: '110101199001011234',
      }

      const result = DataValidator.validateLoginCredentials(validCredentials)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validatePatient', () => {
    it('should validate complete patient data', () => {
      const validPatient: Partial<Patient> = {
        name: '张三',
        age: 30,
        gender: 'male',
        phone: '13812345678',
        idCard: '110101199001011234',
      }

      const result = DataValidator.validatePatient(validPatient)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject patient with empty name', () => {
      const invalidPatient: Partial<Patient> = {
        name: '',
        age: 30,
        gender: 'male',
        phone: '13812345678',
      }

      const result = DataValidator.validatePatient(invalidPatient)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('name')
      expect(result.errors[0].code).toBe('REQUIRED')
    })

    it('should reject patient with invalid age', () => {
      const invalidPatient: Partial<Patient> = {
        name: '张三',
        age: 200,
        gender: 'male',
        phone: '13812345678',
      }

      const result = DataValidator.validatePatient(invalidPatient)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('age')
      expect(result.errors[0].code).toBe('OUT_OF_RANGE')
    })

    it('should reject patient with invalid gender', () => {
      const invalidPatient: Partial<Patient> = {
        name: '张三',
        age: 30,
        gender: 'other' as any,
        phone: '13812345678',
      }

      const result = DataValidator.validatePatient(invalidPatient)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('gender')
      expect(result.errors[0].code).toBe('INVALID_VALUE')
    })

    it('should reject patient with invalid phone', () => {
      const invalidPatient: Partial<Patient> = {
        name: '张三',
        age: 30,
        gender: 'male',
        phone: '12345',
      }

      const result = DataValidator.validatePatient(invalidPatient)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('phone')
      expect(result.errors[0].code).toBe('INVALID_FORMAT')
    })
  })

  describe('validateSendMessageRequest', () => {
    it('should validate text message request', () => {
      const validRequest: SendMessageRequest = {
        consultationId: 'consultation-123',
        type: 'text',
        content: 'Hello, this is a test message',
      }

      const result = DataValidator.validateSendMessageRequest(validRequest)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject message request with empty consultation ID', () => {
      const invalidRequest: SendMessageRequest = {
        consultationId: '',
        type: 'text',
        content: 'Hello',
      }

      const result = DataValidator.validateSendMessageRequest(invalidRequest)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('consultationId')
      expect(result.errors[0].code).toBe('REQUIRED')
    })

    it('should reject text message with empty content', () => {
      const invalidRequest: SendMessageRequest = {
        consultationId: 'consultation-123',
        type: 'text',
        content: '',
      }

      const result = DataValidator.validateSendMessageRequest(invalidRequest)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('content')
      expect(result.errors[0].code).toBe('REQUIRED')
    })

    it('should reject text message with too long content', () => {
      const invalidRequest: SendMessageRequest = {
        consultationId: 'consultation-123',
        type: 'text',
        content: 'a'.repeat(5001),
      }

      const result = DataValidator.validateSendMessageRequest(invalidRequest)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('content')
      expect(result.errors[0].code).toBe('MAX_LENGTH')
    })

    it('should reject file message without file ID', () => {
      const invalidRequest: SendMessageRequest = {
        consultationId: 'consultation-123',
        type: 'file',
        content: 'file description',
      }

      const result = DataValidator.validateSendMessageRequest(invalidRequest)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('fileId')
      expect(result.errors[0].code).toBe('REQUIRED')
    })
  })

  describe('validatePatientQuery', () => {
    it('should validate patient query', () => {
      const validQuery: PatientQuery = {
        page: 1,
        pageSize: 20,
        keyword: '张三',
        gender: 'male',
        ageRange: { min: 20, max: 60 },
      }

      const result = DataValidator.validatePatientQuery(validQuery)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject query with invalid page', () => {
      const invalidQuery: PatientQuery = {
        page: 0,
        pageSize: 20,
      }

      const result = DataValidator.validatePatientQuery(invalidQuery)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('page')
      expect(result.errors[0].code).toBe('MIN_VALUE')
    })

    it('should reject query with invalid page size', () => {
      const invalidQuery: PatientQuery = {
        page: 1,
        pageSize: 200,
      }

      const result = DataValidator.validatePatientQuery(invalidQuery)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('pageSize')
      expect(result.errors[0].code).toBe('OUT_OF_RANGE')
    })

    it('should reject query with invalid age range', () => {
      const invalidQuery: PatientQuery = {
        page: 1,
        pageSize: 20,
        ageRange: { min: 60, max: 30 },
      }

      const result = DataValidator.validatePatientQuery(invalidQuery)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('ageRange')
      expect(result.errors[0].code).toBe('INVALID_RANGE')
    })
  })

  describe('validateWindowConfig', () => {
    it('should validate window config', () => {
      const validConfig: WindowConfig = {
        type: 'consultation',
        title: 'Patient Consultation',
        url: '/consultation/123',
        width: 800,
        height: 600,
      }

      const result = DataValidator.validateWindowConfig(validConfig)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject config with empty title', () => {
      const invalidConfig: WindowConfig = {
        type: 'consultation',
        title: '',
        url: '/consultation/123',
      }

      const result = DataValidator.validateWindowConfig(invalidConfig)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('title')
      expect(result.errors[0].code).toBe('REQUIRED')
    })

    it('should reject config with too small dimensions', () => {
      const invalidConfig: WindowConfig = {
        type: 'consultation',
        title: 'Test Window',
        url: '/test',
        width: 100,
        height: 50,
      }

      const result = DataValidator.validateWindowConfig(invalidConfig)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0].field).toBe('width')
      expect(result.errors[0].code).toBe('MIN_VALUE')
      expect(result.errors[1].field).toBe('height')
      expect(result.errors[1].code).toBe('MIN_VALUE')
    })
  })

  describe('validateFileType', () => {
    it('should validate allowed file type', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']

      const result = DataValidator.validateFileType(file, allowedTypes)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject disallowed file type', () => {
      const file = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      })
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']

      const result = DataValidator.validateFileType(file, allowedTypes)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('type')
      expect(result.errors[0].code).toBe('UNSUPPORTED_TYPE')
    })
  })

  describe('validateFileSize', () => {
    it('should validate file within size limit', () => {
      const file = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })
      const maxSize = 1024 * 1024 // 1MB

      const result = DataValidator.validateFileSize(file, maxSize)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject file exceeding size limit', () => {
      // Create a mock file that appears to be larger than the limit
      const file = { size: 2 * 1024 * 1024 } as File // 2MB
      const maxSize = 1024 * 1024 // 1MB

      const result = DataValidator.validateFileSize(file, maxSize)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('size')
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE')
    })
  })

  describe('createValidationError', () => {
    it('should create validation error with violations', () => {
      const violations = [
        { field: 'name', message: 'Name is required', code: 'REQUIRED' },
        { field: 'age', message: 'Age is invalid', code: 'INVALID_VALUE' },
      ]

      const error = DataValidator.createValidationError(violations)
      expect(error.type).toBe('VALIDATION_ERROR')
      expect(error.message).toBe('数据验证失败')
      expect(error.violations).toEqual(violations)
      expect(error.timestamp).toBeInstanceOf(Date)
    })
  })
})
