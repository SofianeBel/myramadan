import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')

import { togglePrayer, toggleFasting, setQuranPages, addDhikrCount, getStreak, getPracticeLog } from './practice-tracker.js'
import storage from './storage.js'

beforeEach(() => {
  storage._reset()
})

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function setLog(log) {
  storage.set('practiceLog', log)
}

// ─── togglePrayer ───

describe('togglePrayer', () => {
  it('toggles a prayer from false to true', () => {
    togglePrayer(0) // Fajr
    const log = getPracticeLog()
    expect(log[todayKey()].prayers[0]).toBe(true)
  })

  it('toggles a prayer back to false', () => {
    togglePrayer(0)
    togglePrayer(0)
    const log = getPracticeLog()
    expect(log[todayKey()].prayers[0]).toBe(false)
  })

  it('only toggles the specified prayer index', () => {
    togglePrayer(2) // Asr
    const entry = getPracticeLog()[todayKey()]
    expect(entry.prayers[0]).toBe(false)
    expect(entry.prayers[1]).toBe(false)
    expect(entry.prayers[2]).toBe(true)
    expect(entry.prayers[3]).toBe(false)
    expect(entry.prayers[4]).toBe(false)
  })

  it('creates entry if none exists for today', () => {
    expect(getPracticeLog()[todayKey()]).toBeUndefined()
    togglePrayer(0)
    expect(getPracticeLog()[todayKey()]).toBeDefined()
  })
})

// ─── toggleFasting ───

describe('toggleFasting', () => {
  it('toggles fasting from false to true', () => {
    toggleFasting()
    expect(getPracticeLog()[todayKey()].fasting).toBe(true)
  })

  it('toggles fasting back to false', () => {
    toggleFasting()
    toggleFasting()
    expect(getPracticeLog()[todayKey()].fasting).toBe(false)
  })
})

// ─── setQuranPages ───

describe('setQuranPages', () => {
  it('sets quran pages count', () => {
    setQuranPages(5)
    expect(getPracticeLog()[todayKey()].quranPages).toBe(5)
  })

  it('clamps to minimum 0', () => {
    setQuranPages(-10)
    expect(getPracticeLog()[todayKey()].quranPages).toBe(0)
  })

  it('clamps to maximum 50', () => {
    setQuranPages(100)
    expect(getPracticeLog()[todayKey()].quranPages).toBe(50)
  })

  it('handles NaN input as 0', () => {
    setQuranPages('abc')
    expect(getPracticeLog()[todayKey()].quranPages).toBe(0)
  })

  it('handles string number input', () => {
    setQuranPages('12')
    expect(getPracticeLog()[todayKey()].quranPages).toBe(12)
  })
})

// ─── addDhikrCount ───

describe('addDhikrCount', () => {
  it('adds count to dhikr', () => {
    addDhikrCount(33)
    expect(getPracticeLog()[todayKey()].dhikrCount).toBe(33)
  })

  it('accumulates multiple additions', () => {
    addDhikrCount(33)
    addDhikrCount(33)
    addDhikrCount(34)
    expect(getPracticeLog()[todayKey()].dhikrCount).toBe(100)
  })

  it('starts from 0 for new entry', () => {
    addDhikrCount(1)
    expect(getPracticeLog()[todayKey()].dhikrCount).toBe(1)
  })
})

// ─── getStreak ───

describe('getStreak', () => {
  it('returns 0 when log is empty', () => {
    expect(getStreak('prayers')).toBe(0)
    expect(getStreak('fasting')).toBe(0)
    expect(getStreak('quran')).toBe(0)
    expect(getStreak('dhikr')).toBe(0)
  })

  it('returns 1 when only today has all prayers', () => {
    const today = todayKey()
    setLog({
      [today]: { prayers: [true, true, true, true, true], fasting: false, quranPages: 0, dhikrCount: 0 }
    })
    expect(getStreak('prayers')).toBe(1)
  })

  it('returns 0 when today has incomplete prayers', () => {
    const today = todayKey()
    setLog({
      [today]: { prayers: [true, true, false, true, true], fasting: false, quranPages: 0, dhikrCount: 0 }
    })
    expect(getStreak('prayers')).toBe(0)
  })

  it('counts consecutive fasting days', () => {
    const d = new Date()
    const days = []
    for (let i = 0; i < 3; i++) {
      const date = new Date(d)
      date.setDate(date.getDate() - i)
      days.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
    }
    const log = {}
    days.forEach(key => {
      log[key] = { prayers: [false, false, false, false, false], fasting: true, quranPages: 0, dhikrCount: 0 }
    })
    setLog(log)
    expect(getStreak('fasting')).toBe(3)
  })

  it('breaks streak when a day is missed', () => {
    const d = new Date()
    const today = todayKey()
    const yesterday = new Date(d)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    const twoDaysAgo = new Date(d)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoKey = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`

    setLog({
      [today]: { prayers: [false, false, false, false, false], fasting: true, quranPages: 0, dhikrCount: 0 },
      [yesterdayKey]: { prayers: [false, false, false, false, false], fasting: false, quranPages: 0, dhikrCount: 0 },
      [twoDaysAgoKey]: { prayers: [false, false, false, false, false], fasting: true, quranPages: 0, dhikrCount: 0 },
    })
    // Streak should be 1 (today only, yesterday broke the chain)
    expect(getStreak('fasting')).toBe(1)
  })

  it('does not count non-consecutive days (date gap with no entry)', () => {
    const d = new Date()
    const today = todayKey()
    // Skip yesterday entirely (no entry), have an entry two days ago
    const twoDaysAgo = new Date(d)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoKey = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`

    setLog({
      [today]: { prayers: [true, true, true, true, true], fasting: true, quranPages: 5, dhikrCount: 10 },
      [twoDaysAgoKey]: { prayers: [true, true, true, true, true], fasting: true, quranPages: 5, dhikrCount: 10 },
    })
    // Streak should be 1 for all fields (yesterday missing = gap)
    expect(getStreak('prayers')).toBe(1)
    expect(getStreak('fasting')).toBe(1)
    expect(getStreak('quran')).toBe(1)
    expect(getStreak('dhikr')).toBe(1)
  })

  it('counts quran streak when pages >= 1', () => {
    const today = todayKey()
    setLog({
      [today]: { prayers: [false, false, false, false, false], fasting: false, quranPages: 3, dhikrCount: 0 }
    })
    expect(getStreak('quran')).toBe(1)
  })

  it('counts dhikr streak when count >= 1', () => {
    const today = todayKey()
    setLog({
      [today]: { prayers: [false, false, false, false, false], fasting: false, quranPages: 0, dhikrCount: 100 }
    })
    expect(getStreak('dhikr')).toBe(1)
  })
})

// ─── getPracticeLog ───

describe('getPracticeLog', () => {
  it('returns empty object when no data', () => {
    expect(getPracticeLog()).toEqual({})
  })

  it('returns log after modifications', () => {
    togglePrayer(0)
    const log = getPracticeLog()
    expect(Object.keys(log).length).toBeGreaterThanOrEqual(1)
  })
})
