import { describe, it, expect } from 'vitest'
import { formatLocalDate, formatLocalDateForAladhan } from './local-date.js'

describe('local date helpers', () => {
  it('formats a calendar date using local components', () => {
    expect(formatLocalDate(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02')
  })

  it('formats Aladhan path dates from local components', () => {
    expect(formatLocalDateForAladhan(new Date(2026, 10, 5, 1, 15))).toBe('05-11-2026')
  })
})
