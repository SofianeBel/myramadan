import { describe, it, expect, beforeEach } from 'vitest'

describe('platform detection', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('platform-android', 'platform-desktop')
  })

  describe('applyPlatformClass', () => {
    it('adds platform-desktop class by default (jsdom = desktop UA)', async () => {
      const { applyPlatformClass } = await import('./platform.js')
      applyPlatformClass()
      expect(document.documentElement.classList.contains('platform-desktop')).toBe(true)
      expect(document.documentElement.classList.contains('platform-android')).toBe(false)
    })
  })

  describe('exports', () => {
    it('exports isDesktop as true in jsdom environment', async () => {
      const { isDesktop, isMobile, isAndroid } = await import('./platform.js')
      expect(isDesktop).toBe(true)
      expect(isMobile).toBe(false)
      expect(isAndroid).toBe(false)
    })
  })
})
