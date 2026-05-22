import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')

import storage from './storage.js'
import { calculateGoalProgress } from './statistics.js'

beforeEach(() => {
  storage._reset()
})

describe('calculateGoalProgress', () => {
  it('counts Monday/Thursday fasting as completed weeks, not raw fasting days', () => {
    storage.set('practiceLog', {
      '2026-05-18': { fasting: true }, // Monday
      '2026-05-20': { fasting: true }, // Wednesday should not count
      '2026-05-21': { fasting: true }, // Thursday completes the week
      '2026-05-25': { fasting: true }, // Monday alone is not a completed week
    })

    expect(calculateGoalProgress({ type: 'fasting-weeks', target: 4 })).toBe(1)
  })
})
