import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))
vi.mock('./storage.js')

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { buildAladhanUrl, fetchPrayerTimes, fetchMonthCalendar, fetchMawaqitTimes, fetchMawaqitCalendar, searchMosques, timeToMinutes, minutesToTime } from './prayer-times.js'
import storage from './storage.js'
import { formatLocalDate } from './local-date.js'

beforeEach(() => {
  storage._reset()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  tauriFetch.mockReset()
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

describe('time helpers', () => {
  it('parses Aladhan timezone suffixes before minute calculations', () => {
    expect(timeToMinutes('05:12 (CET)')).toBe(312)
  })

  it('normalizes minute offsets across midnight', () => {
    expect(minutesToTime(-1)).toBe('23:59')
    expect(minutesToTime(24 * 60 + 5)).toBe('00:05')
  })
})

describe('Mawaqit search coordinate normalization', () => {
  it('keeps zero-valued mosque coordinates but rejects empty coordinates', async () => {
    tauriFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Zero', slug: 'zero', latitude: '0', longitude: 0 },
        { name: 'Empty', slug: 'empty', latitude: '', longitude: null },
      ],
    })

    await expect(searchMosques('test')).resolves.toMatchObject([
      { latitude: 0, longitude: 0 },
      { latitude: null, longitude: null },
    ])
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

describe('Mawaqit fetch guards', () => {
  it('does not reuse another mosque cache entry when a new mosque fetch fails', async () => {
    storage.set('mawaqitCache', {
      date: formatLocalDate(),
      mosqueSlug: 'old-mosque',
      data: { timings: { Fajr: '05:00', Maghrib: '20:00' } },
    })
    tauriFetch.mockRejectedValue(new Error('network down'))

    await expect(fetchMawaqitTimes('new-mosque')).resolves.toBeNull()
  })

  it('rejects search results that do not contain the selected mosque slug', async () => {
    tauriFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { slug: 'wrong-mosque', times: ['05:00', '06:30', '13:00', '17:00', '20:00', '22:00'] },
      ],
    })

    await expect(fetchMawaqitTimes('selected-mosque')).resolves.toBeNull()
  })
})

describe('Mawaqit calendar cache', () => {
  function mawaqitCalendarHtml() {
    const calendar = Array.from({ length: 12 }, () => ({}))
    return `window.confData = ${JSON.stringify({ calendar })};`
  }

  it('does not use the current Mawaqit page for a different Gregorian year', async () => {
    tauriFetch.mockResolvedValue({
      ok: true,
      text: async () => mawaqitCalendarHtml(),
    })

    await expect(fetchMawaqitCalendar('selected-mosque', new Date().getFullYear() + 1)).resolves.toBeNull()
    expect(tauriFetch).not.toHaveBeenCalled()
  })

  it('caches the scraped annual Mawaqit calendar for the same mosque and year', async () => {
    tauriFetch.mockResolvedValue({
      ok: true,
      text: async () => mawaqitCalendarHtml(),
    })

    const year = new Date().getFullYear()
    await expect(fetchMawaqitCalendar('selected-mosque', year)).resolves.toHaveLength(12)
    await expect(fetchMawaqitCalendar('selected-mosque', year)).resolves.toHaveLength(12)
    expect(tauriFetch).toHaveBeenCalledTimes(1)
  })
})
