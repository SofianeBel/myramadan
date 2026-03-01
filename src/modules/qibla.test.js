import { describe, it, expect } from 'vitest'
import { calculateQiblaDirection, getCardinalDirection } from './qibla.js'

// ─── calculateQiblaDirection ───

describe('calculateQiblaDirection', () => {
  it('returns bearing in range 0-360', () => {
    const bearing = calculateQiblaDirection(48.8566, 2.3522) // Paris
    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThan(360)
  })

  it('calculates correct bearing from Paris (≈119°)', () => {
    const bearing = calculateQiblaDirection(48.8566, 2.3522)
    // Paris → Kaaba should be roughly ESE (~119°)
    expect(bearing).toBeCloseTo(119, 0)
  })

  it('calculates correct bearing from New York (≈58°)', () => {
    const bearing = calculateQiblaDirection(40.7128, -74.006)
    // NYC → Kaaba should be roughly ENE (~58°)
    expect(bearing).toBeCloseTo(58, 0)
  })

  it('calculates correct bearing from Tokyo (≈293°)', () => {
    const bearing = calculateQiblaDirection(35.6762, 139.6503)
    // Tokyo → Kaaba should be roughly WNW (~293°)
    expect(bearing).toBeCloseTo(293, 0)
  })

  it('calculates correct bearing from Jakarta (≈295°)', () => {
    const bearing = calculateQiblaDirection(-6.2088, 106.8456)
    // Jakarta → Kaaba should be roughly WNW (~295°)
    expect(bearing).toBeCloseTo(295, 0)
  })

  it('calculates correct bearing from Casablanca (≈94°)', () => {
    const bearing = calculateQiblaDirection(33.5731, -7.5898)
    // Casablanca → Kaaba should be roughly E (~94°)
    expect(bearing).toBeCloseTo(94, 0)
  })

  it('returns near 0 from directly south of Kaaba', () => {
    // Point directly south of Kaaba (same longitude)
    const bearing = calculateQiblaDirection(-10, 39.8262)
    // Should point almost due North (~0°)
    expect(bearing).toBeCloseTo(0, 0)
  })

  it('returns near 180 from directly north of Kaaba', () => {
    // Point directly north of Kaaba (same longitude)
    const bearing = calculateQiblaDirection(60, 39.8262)
    // Should point almost due South (~180°)
    expect(bearing).toBeCloseTo(180, 0)
  })

  it('handles coordinates at the Kaaba itself', () => {
    // At the Kaaba, bearing calculation is degenerate but should not throw
    const bearing = calculateQiblaDirection(21.4225, 39.8262)
    expect(typeof bearing).toBe('number')
    expect(bearing).not.toBeNaN()
  })
})

// ─── getCardinalDirection ───

describe('getCardinalDirection', () => {
  it('returns N for 0°', () => {
    expect(getCardinalDirection(0)).toBe('N')
  })

  it('returns N for 360°', () => {
    expect(getCardinalDirection(360)).toBe('N')
  })

  it('returns NE for 45°', () => {
    expect(getCardinalDirection(45)).toBe('NE')
  })

  it('returns E for 90°', () => {
    expect(getCardinalDirection(90)).toBe('E')
  })

  it('returns SE for 135°', () => {
    expect(getCardinalDirection(135)).toBe('SE')
  })

  it('returns S for 180°', () => {
    expect(getCardinalDirection(180)).toBe('S')
  })

  it('returns SO for 225°', () => {
    expect(getCardinalDirection(225)).toBe('SO')
  })

  it('returns O for 270°', () => {
    expect(getCardinalDirection(270)).toBe('O')
  })

  it('returns NO for 315°', () => {
    expect(getCardinalDirection(315)).toBe('NO')
  })

  it('handles intermediate angles correctly', () => {
    // 60° is closer to NE (45°) than to E (90°)
    expect(getCardinalDirection(60)).toBe('NE')
    // 80° is closer to E (90°) than to NE (45°)
    expect(getCardinalDirection(80)).toBe('E')
  })
})
