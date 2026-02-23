/**
 * fasting.js — Calculate and display fasting progress
 */

import { timeToMinutes, getCurrentMinutes, minutesToTime } from './prayer-times.js'

/** Query all fasting-related DOM elements */
function getFastingElements() {
  return {
    suhoorEl: document.getElementById('suhoor-time'),
    iftarEl: document.getElementById('iftar-time'),
    suhoorStatus: document.getElementById('suhoor-status'),
    iftarStatus: document.getElementById('iftar-status'),
    progressFill: document.querySelector('.progress-fill'),
    progressPct: document.getElementById('progress-percentage'),
    timeRemaining: document.getElementById('time-remaining'),
  }
}

/** Toggle visibility of progress bar and labels (hide when not fasting) */
function toggleProgressBar(show) {
  const labels = document.querySelector('.progress-labels')
  const bar = document.querySelector('.progress-bar')
  if (labels) labels.style.display = show ? '' : 'none'
  if (bar) bar.style.display = show ? '' : 'none'
}

/**
 * Update the fasting card UI.
 * @param {string} fajrTime - "HH:MM" Fajr time (Suhoor ends)
 * @param {string} maghribTime - "HH:MM" Maghrib time (Iftar)
 */
export function updateFasting(fajrTime, maghribTime) {
  const { suhoorEl, iftarEl, suhoorStatus, iftarStatus, progressFill, progressPct, timeRemaining } = getFastingElements()

  if (!suhoorEl || !iftarEl) return

  // Display times
  suhoorEl.textContent = fajrTime
  iftarEl.textContent = maghribTime

  const fajrMin = timeToMinutes(fajrTime)
  const maghribMin = timeToMinutes(maghribTime)
  const nowMin = getCurrentMinutes()

  const fastingDuration = maghribMin - fajrMin
  const elapsed = nowMin - fajrMin
  const remaining = maghribMin - nowMin

  // Before Fajr — fasting not started
  if (nowMin < fajrMin) {
    if (suhoorStatus) suhoorStatus.textContent = 'Bientôt'
    if (iftarStatus) iftarStatus.textContent = '--'
    if (progressFill) progressFill.style.width = '0%'
    if (progressPct) progressPct.textContent = '0%'
    toggleProgressBar(false)
    if (timeRemaining) {
      const untilFajr = fajrMin - nowMin
      timeRemaining.textContent = `Bon appétit ! Suhoor dans ${formatDuration(untilFajr)}`
    }
    return
  }

  // After Maghrib — fasting complete
  if (nowMin >= maghribMin) {
    if (suhoorStatus) suhoorStatus.textContent = 'Terminé'
    if (iftarStatus) iftarStatus.textContent = 'C\'est l\'heure !'
    if (progressFill) progressFill.style.width = '100%'
    if (progressPct) progressPct.textContent = '100%'
    toggleProgressBar(false)
    if (timeRemaining) timeRemaining.textContent = 'Le jeûne est terminé — Bon Iftar !'
    return
  }

  // During fasting
  toggleProgressBar(true)
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / fastingDuration) * 100)))

  if (suhoorStatus) suhoorStatus.textContent = 'En cours'
  if (iftarStatus) iftarStatus.textContent = formatDuration(remaining)
  if (progressFill) progressFill.style.width = `${pct}%`
  if (progressPct) progressPct.textContent = `${pct}%`
  if (timeRemaining) timeRemaining.textContent = `Iftar dans ${formatDuration(remaining)}`
}

/**
 * Show Suhoor/Iftar times as reference for a non-today date.
 * No progress calculation — just display times.
 * @param {string} fajrTime - "HH:MM" Fajr time
 * @param {string} maghribTime - "HH:MM" Maghrib time
 */
export function updateFastingReference(fajrTime, maghribTime) {
  const { suhoorEl, iftarEl, suhoorStatus, iftarStatus, progressFill, progressPct, timeRemaining } = getFastingElements()

  if (!suhoorEl || !iftarEl) return

  suhoorEl.textContent = fajrTime
  iftarEl.textContent = maghribTime
  if (suhoorStatus) suhoorStatus.textContent = '--'
  if (iftarStatus) iftarStatus.textContent = '--'
  if (progressFill) progressFill.style.width = '0%'
  if (progressPct) progressPct.textContent = '--'
  toggleProgressBar(false)
  if (timeRemaining) timeRemaining.textContent = ''
}

/**
 * Format total minutes to human-readable string.
 * @param {number} totalMinutes
 * @returns {string}
 */
function formatDuration(totalMinutes) {
  if (totalMinutes <= 0) return '0 min'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}
