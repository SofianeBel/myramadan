import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')

import { getRamadanDay, resolveMode, applyMode, setAppMode, isRamadanEve } from './app-mode.js'
import storage from './storage.js'

beforeEach(() => {
  storage._reset()
  // Minimal DOM mock for applyMode
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

  it('returns null when month is not Ramadan (month !== 9)', () => {
    expect(getRamadanDay({ month: 8, day: 15 })).toBeNull()
    expect(getRamadanDay({ month: 10, day: 1 })).toBeNull()
    expect(getRamadanDay({ month: 1, day: 5 })).toBeNull()
  })

  it('returns the day when month is Ramadan (month === 9)', () => {
    expect(getRamadanDay({ month: 9, day: 1 })).toBe(1)
    expect(getRamadanDay({ month: 9, day: 15 })).toBe(15)
    expect(getRamadanDay({ month: 9, day: 30 })).toBe(30)
  })
})

// ─── resolveMode ───

describe('resolveMode', () => {
  it('returns "ramadan" when setting is "ramadan" regardless of date', () => {
    storage.set('appMode', 'ramadan')
    expect(resolveMode({ month: 1, day: 1 })).toBe('ramadan')
    expect(resolveMode(null)).toBe('ramadan')
  })

  it('returns "normal" when setting is "normal" regardless of date', () => {
    storage.set('appMode', 'normal')
    expect(resolveMode({ month: 9, day: 15 })).toBe('normal')
  })

  it('auto-detects ramadan mode when setting is "auto" and month is 9', () => {
    storage.set('appMode', 'auto')
    expect(resolveMode({ month: 9, day: 10 })).toBe('ramadan')
  })

  it('auto-detects normal mode when setting is "auto" and month is not 9', () => {
    storage.set('appMode', 'auto')
    expect(resolveMode({ month: 8, day: 29 })).toBe('normal')
  })

  it('defaults to "auto" when no setting is stored', () => {
    // No appMode set in storage
    expect(resolveMode({ month: 9, day: 1 })).toBe('ramadan')
    expect(resolveMode({ month: 3, day: 1 })).toBe('normal')
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
    expect(isRamadanEve({ month: 7, day: 29 })).toBe(false)
    expect(isRamadanEve({ month: 9, day: 1 })).toBe(false)
  })

  it('returns false for early Shaaban days', () => {
    expect(isRamadanEve({ month: 8, day: 1 })).toBe(false)
    expect(isRamadanEve({ month: 8, day: 28 })).toBe(false)
  })

  it('returns true for Shaaban day 29', () => {
    expect(isRamadanEve({ month: 8, day: 29 })).toBe(true)
  })

  it('returns true for Shaaban day 30', () => {
    expect(isRamadanEve({ month: 8, day: 30 })).toBe(true)
  })
})
