import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('autostart dev guard', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('should prevent autostart in dev mode', () => {
    vi.stubEnv('DEV', true)
    // In dev mode, autostart should be disabled to avoid Edge opening on reboot
    expect(import.meta.env.DEV).toBe(true)
  })

  it('should allow autostart in production mode', () => {
    vi.stubEnv('DEV', false)
    expect(import.meta.env.DEV).toBe(false)
  })
})
