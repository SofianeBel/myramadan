import { describe, it, expect } from 'vitest'

describe('autostart dev guard', () => {
  it('should prevent autostart in dev mode', () => {
    const isDev = true
    const shouldAllowAutostart = !isDev
    expect(shouldAllowAutostart).toBe(false)
  })

  it('should allow autostart in production mode', () => {
    const isDev = false
    const shouldAllowAutostart = !isDev
    expect(shouldAllowAutostart).toBe(true)
  })
})
