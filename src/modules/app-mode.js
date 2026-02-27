// src/modules/app-mode.js
import storage from './storage.js'

const APP_MODE_KEY = 'appMode'

function getHijriMonth(hijriDate) {
  if (!hijriDate) return null
  // Aladhan renvoie month comme objet { number, en, ar } ou comme nombre
  const m = hijriDate.month
  return typeof m === 'object' ? m?.number : m
}

function getHijriDay(hijriDate) {
  if (!hijriDate) return null
  // Aladhan renvoie day comme string "10" ou nombre
  return typeof hijriDate.day === 'string' ? parseInt(hijriDate.day, 10) : hijriDate.day
}

function isRamadanPeriod(hijriDate) {
  if (!hijriDate) return false
  return getHijriMonth(hijriDate) === 9
}

export function getRamadanDay(hijriDate) {
  if (!isRamadanPeriod(hijriDate)) return null
  return getHijriDay(hijriDate)
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
  return getHijriMonth(hijriDate) === 8 && getHijriDay(hijriDate) >= 29
}
