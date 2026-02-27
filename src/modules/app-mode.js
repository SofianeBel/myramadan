// src/modules/app-mode.js
import storage from './storage.js'

const APP_MODE_KEY = 'appMode'

function isRamadanPeriod(hijriDate) {
  if (!hijriDate) return false
  return hijriDate.month === 9
}

export function getRamadanDay(hijriDate) {
  if (!isRamadanPeriod(hijriDate)) return null
  return hijriDate.day
}

export function resolveMode(hijriDate) {
  const setting = storage.get(APP_MODE_KEY) || 'auto'
  if (setting === 'ramadan') return 'ramadan'
  if (setting === 'normal') return 'normal'
  return isRamadanPeriod(hijriDate) ? 'ramadan' : 'normal'
}

export function applyMode(mode) {
  document.body.classList.toggle('mode-ramadan', mode === 'ramadan')
  document.body.classList.toggle('mode-normal', mode === 'normal')
}

export function setAppMode(mode) {
  storage.set(APP_MODE_KEY, mode)
}

export function isRamadanEve(hijriDate) {
  if (!hijriDate) return false
  return hijriDate.month === 8 && hijriDate.day >= 29
}
