import { describe, it, expect, vi } from 'vitest'
import { generateId } from './uuid'

describe('generateId', () => {
  it('should generate a valid UUID v4 format', () => {
    const id = generateId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidRegex)
  })

  it('should generate unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })

  it('should use crypto.randomUUID when available', () => {
    const mockUUID = '12345678-1234-4234-8234-123456789012'
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID)
    
    const id = generateId()
    expect(id).toBe(mockUUID)
    expect(spy).toHaveBeenCalled()
    
    spy.mockRestore()
  })

  it('should fallback to Math.random when crypto.randomUUID is not available', () => {
    const originalRandomUUID = crypto.randomUUID
    // Delete for test
    delete crypto.randomUUID
    
    const id = generateId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidRegex)
    
    // Restore
    crypto.randomUUID = originalRandomUUID
  })
})
