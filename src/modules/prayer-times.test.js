import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))
vi.mock('./storage.js')

import { buildAladhanUrl, fetchPrayerTimes, fetchMonthCalendar } from './prayer-times.js'
import storage from './storage.js'

beforeEach(() => {
  storage._reset()
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn()
})

describe('buildAladhanUrl', () => {
  it('returns null instead of silently falling back to Paris', () => {
    expect(buildAladhanUrl({ method: 12 })).toBeNull()
  })

  it('uses coordinates when available', () => {
    const url = buildAladhanUrl({ lat: 48.8566, lon: 2.3522, method: 12 })
    expect(url).toBe('https://api.aladhan.com/v1/timings?latitude=48.8566&longitude=2.3522&method=12')
  })

  it('uses saved city and country when no coordinates are available', () => {
    const url = buildAladhanUrl({ city: 'Lyon', country: 'France', method: 12 })
    expect(url).toBe('https://api.aladhan.com/v1/timingsByCity?city=Lyon&country=France&method=12')
  })

  it('adds date path and custom angles when provided', () => {
    const url = buildAladhanUrl({
      city: 'Marseille',
      country: 'France',
      method: 12,
      angles: { fajr: 15, isha: 15 },
      dateStr: '22-05-2026',
    })
    expect(url).toBe('https://api.aladhan.com/v1/timingsByCity/22-05-2026?city=Marseille&country=France&method=99&methodSettings=15,null,15')
  })
})

describe('Aladhan fetch guards', () => {
  it('does not call fetch when prayer location is missing', async () => {
    await expect(fetchPrayerTimes({ method: 12 })).resolves.toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('does not call fetch for month calendar when location is missing', async () => {
    await expect(fetchMonthCalendar(2026, 5, { method: 12 })).resolves.toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
