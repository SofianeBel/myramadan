import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')

import { getRamadanDay, resolveMode, applyMode, setAppMode, isRamadanEve } from './app-mode.js'
import storage from './storage.js'

// Helper: format Aladhan hijri date (real API format)
function hijri(month, day) {
  return {
    month: { number: month, en: 'Month', ar: 'شهر' },
    day: String(day),
    year: '1447',
  }
}

beforeEach(() => {
  storage._reset()
  document.body.classList.remove('mode-ramadan', 'mode-normal')
})

// ─── getRamadanDay ───

describe('getRamadanDay', () => {
  it('returns null when hijriDate is null', () => {
    expect(getRamadanDay(null)).toBeNull()
  })

  it('returns null when hijriDate is undefined', () => {
    expect(getRamadanDay(undefined)).toBeNull()
  })

  it('returns null when month is not Ramadan', () => {
    expect(getRamadanDay(hijri(8, 15))).toBeNull()
    expect(getRamadanDay(hijri(10, 1))).toBeNull()
    expect(getRamadanDay(hijri(1, 5))).toBeNull()
  })

  it('returns the day when month is Ramadan (Aladhan format)', () => {
    expect(getRamadanDay(hijri(9, 1))).toBe(1)
    expect(getRamadanDay(hijri(9, 15))).toBe(15)
    expect(getRamadanDay(hijri(9, 30))).toBe(30)
  })

  it('handles plain number month format (backward compat)', () => {
    expect(getRamadanDay({ month: 9, day: 10 })).toBe(10)
    expect(getRamadanDay({ month: 8, day: 10 })).toBeNull()
  })
})

// ─── resolveMode ───

describe('resolveMode', () => {
  it('returns "ramadan" when setting is "ramadan" regardless of date', () => {
    storage.set('appMode', 'ramadan')
    expect(resolveMode(hijri(1, 1))).toBe('ramadan')
    expect(resolveMode(null)).toBe('ramadan')
  })

  it('returns "normal" when setting is "normal" regardless of date', () => {
    storage.set('appMode', 'normal')
    expect(resolveMode(hijri(9, 15))).toBe('normal')
  })

  it('auto-detects ramadan mode when setting is "auto" and month is 9', () => {
    storage.set('appMode', 'auto')
    expect(resolveMode(hijri(9, 10))).toBe('ramadan')
  })

  it('auto-detects normal mode when setting is "auto" and month is not 9', () => {
    storage.set('appMode', 'auto')
    expect(resolveMode(hijri(8, 29))).toBe('normal')
  })

  it('defaults to "auto" when no setting is stored', () => {
    expect(resolveMode(hijri(9, 1))).toBe('ramadan')
    expect(resolveMode(hijri(3, 1))).toBe('normal')
  })

  it('returns "normal" when hijriDate is null in auto mode', () => {
    expect(resolveMode(null)).toBe('normal')
  })
})

// ─── applyMode ───

describe('applyMode', () => {
  it('adds mode-ramadan class when mode is "ramadan"', () => {
    applyMode('ramadan')
    expect(document.body.classList.contains('mode-ramadan')).toBe(true)
    expect(document.body.classList.contains('mode-normal')).toBe(false)
  })

  it('adds mode-normal class when mode is "normal"', () => {
    applyMode('normal')
    expect(document.body.classList.contains('mode-normal')).toBe(true)
    expect(document.body.classList.contains('mode-ramadan')).toBe(false)
  })

  it('removes previous mode class when switching', () => {
    applyMode('ramadan')
    applyMode('normal')
    expect(document.body.classList.contains('mode-ramadan')).toBe(false)
    expect(document.body.classList.contains('mode-normal')).toBe(true)
  })
})

// ─── setAppMode ───

describe('setAppMode', () => {
  it('persists mode in storage', () => {
    setAppMode('ramadan')
    expect(storage.get('appMode')).toBe('ramadan')
  })

  it('persists "normal" mode', () => {
    setAppMode('normal')
    expect(storage.get('appMode')).toBe('normal')
  })

  it('persists "auto" mode', () => {
    setAppMode('auto')
    expect(storage.get('appMode')).toBe('auto')
  })
})

// ─── isRamadanEve ───

describe('isRamadanEve', () => {
  it('returns false when hijriDate is null', () => {
    expect(isRamadanEve(null)).toBe(false)
  })

  it('returns false when hijriDate is undefined', () => {
    expect(isRamadanEve(undefined)).toBe(false)
  })

  it('returns false for month other than Shaaban (month 8)', () => {
    expect(isRamadanEve(hijri(7, 29))).toBe(false)
    expect(isRamadanEve(hijri(9, 1))).toBe(false)
  })

  it('returns false for early Shaaban days', () => {
    expect(isRamadanEve(hijri(8, 1))).toBe(false)
    expect(isRamadanEve(hijri(8, 28))).toBe(false)
  })

  it('returns true for Shaaban day 29', () => {
    expect(isRamadanEve(hijri(8, 29))).toBe(true)
  })

  it('returns true for Shaaban day 30', () => {
    expect(isRamadanEve(hijri(8, 30))).toBe(true)
  })
})
