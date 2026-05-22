import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')
vi.mock('@tauri-apps/plugin-autostart', () => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}))
vi.mock('./prayer-times.js', () => ({
  searchMosques: vi.fn(),
  searchMosquesByLocation: vi.fn(),
}))

import { searchMosques, searchMosquesByLocation } from './prayer-times.js'
import storage from './storage.js'
import {
  getCity,
  getCountry,
  getUserCoords,
  initSettings,
  saveLocation,
  saveUserCoords,
  updateLocationDisplay,
} from './settings.js'

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  storage._reset()
  document.body.innerHTML = ''
})

describe('location settings', () => {
  it('does not default to Paris when no location is saved', () => {
    expect(getCity()).toBeNull()
    expect(getCountry()).toBeNull()
  })

  it('returns finite numeric coordinates from storage', () => {
    saveUserCoords('45.75', '4.85')
    expect(getUserCoords()).toEqual({ lat: 45.75, lon: 4.85 })
  })

  it('renders a missing-position label when neither mosque nor city is saved', () => {
    document.body.innerHTML = '<div class="location"><span></span></div>'
    updateLocationDisplay()
    expect(document.querySelector('.location span').textContent).toBe('Position non détectée')
  })

  it('renders saved city and country when no mosque is selected', () => {
    document.body.innerHTML = '<div class="location"><span></span></div>'
    saveLocation('Lyon', 'France')
    updateLocationDisplay()
    expect(document.querySelector('.location span').textContent).toBe('Lyon, France')
  })

  it('stores selected mosque coordinates for the Aladhan fallback', async () => {
    vi.useFakeTimers()
    searchMosques.mockResolvedValue([
      {
        name: 'Mosquée Test',
        slug: 'mosquee-test',
        localisation: 'Lyon',
        latitude: '45.76',
        longitude: '4.84',
      },
    ])
    searchMosquesByLocation.mockResolvedValue([])

    document.body.innerHTML = `
      <button id="settings-btn"></button>
      <div id="settings-modal" class="hidden">
        <input id="settings-mosque-search">
        <div id="mosque-results"></div>
        <div id="selected-mosque-name"></div>
        <button id="settings-save"></button>
        <button id="settings-cancel"></button>
      </div>
      <div class="location"><span></span></div>
    `

    const onSave = vi.fn()
    initSettings(onSave)

    document.getElementById('settings-btn').click()
    const input = document.getElementById('settings-mosque-search')
    input.value = 'mosquee'
    input.dispatchEvent(new Event('input'))

    await vi.advanceTimersByTimeAsync(400)
    document.querySelector('.mosque-result-item').click()
    document.getElementById('settings-save').click()

    expect(storage.get('mosqueSlug')).toBe('mosquee-test')
    expect(storage.get('mosqueName')).toBe('Mosquée Test')
    expect(storage.get('userCity')).toBeNull()
    expect(storage.get('userCountry')).toBeNull()
    expect(getUserCoords()).toEqual({ lat: 45.76, lon: 4.84 })
    expect(onSave).toHaveBeenCalledWith('mosquee-test')
  })
})
