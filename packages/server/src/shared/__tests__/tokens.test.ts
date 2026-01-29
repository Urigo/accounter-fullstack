
import { describe, it, expect } from 'vitest'
import { AUTH_CONTEXT_V2 } from '../tokens'

describe('AUTH_CONTEXT_V2 Token', () => {
  it('should be defined', () => {
    expect(AUTH_CONTEXT_V2).toBeDefined()
    expect(AUTH_CONTEXT_V2.toString()).toContain('AUTH_CONTEXT_V2')
  })
})
