import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { revealApp, runStartupStep, runStartupStepWithTimeout, createLatestGuard } from './startup.js'

describe('startup guards', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    document.body.innerHTML = `
      <div id="splash-screen"></div>
      <div class="app-container"></div>
    `
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('returns a fallback when a startup step throws', async () => {
    const result = await runStartupStep('broken step', () => {
      throw new Error('boom')
    }, 'fallback')

    expect(result).toBe('fallback')
    expect(console.warn).toHaveBeenCalledWith(
      '[startup] broken step failed:',
      expect.any(Error)
    )
  })

  it('returns a fallback when a startup step times out', async () => {
    const resultPromise = runStartupStepWithTimeout(
      'slow step',
      () => new Promise(() => {}),
      100,
      'fallback'
    )

    await vi.advanceTimersByTimeAsync(100)

    await expect(resultPromise).resolves.toBe('fallback')
    expect(console.warn).toHaveBeenCalledWith('[startup] slow step timed out after 100ms')
  })

  it('reveals the app when called as a startup fallback', () => {
    revealApp()

    expect(document.getElementById('splash-screen').classList.contains('hidden')).toBe(true)
    expect(document.querySelector('.app-container').classList.contains('app-ready')).toBe(true)
  })
})

describe('createLatestGuard', () => {
  it("invalide un appel dès qu'un appel plus récent commence", () => {
    const begin = createLatestGuard()
    const first = begin()
    expect(first()).toBe(true)

    const second = begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })
})
