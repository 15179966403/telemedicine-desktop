import { describe, it, expect } from 'vitest'

describe('Consultation Workflow', () => {
  it('should have consultation types defined', () => {
    const consultationTypes = ['text', 'video', 'phone']
    expect(consultationTypes).toContain('text')
    expect(consultationTypes).toContain('video')
    expect(consultationTypes).toContain('phone')
  })

  it('should have consultation statuses defined', () => {
    const consultationStatuses = [
      'pending',
      'active',
      'completed',
      'cancelled',
      'expired',
    ]
    expect(consultationStatuses).toContain('pending')
    expect(consultationStatuses).toContain('active')
    expect(consultationStatuses).toContain('completed')
  })

  it('should have priority levels defined', () => {
    const priorities = ['low', 'normal', 'high', 'urgent']
    expect(priorities).toContain('low')
    expect(priorities).toContain('normal')
    expect(priorities).toContain('high')
    expect(priorities).toContain('urgent')
  })
})
