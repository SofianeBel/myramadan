/**
 * countdown.js — Countdown timer to next prayer
 */

import { timeToMinutes, getPrayerList } from './prayer-times.js'

let countdownInterval = null

/**
 * Find the next upcoming prayer.
 * @param {Object} timings - Raw timings from API
 * @returns {{ name: string, nameFr: string, time: string, minutesUntil: number } | null}
 */
export function findNextPrayer(timings) {
  const prayers = getPrayerList(timings)
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  for (const prayer of prayers) {
    const prayerMin = timeToMinutes(prayer.time)
    if (prayerMin > nowMin) {
      return { ...prayer, minutesUntil: prayerMin - nowMin }
    }
  }

  // All prayers have passed — next is Fajr tomorrow
  const fajr = prayers[0]
  const fajrMin = timeToMinutes(fajr.time)
  const minutesUntilTomorrow = (24 * 60 - nowMin) + fajrMin
  return { ...fajr, minutesUntil: minutesUntilTomorrow }
}

/**
 * Start the countdown timer.
 * @param {Object} timings - Raw timings from API
 */
export function startCountdown(timings) {
  // Clear any existing interval
  if (countdownInterval) clearInterval(countdownInterval)

  function tick() {
    const next = findNextPrayer(timings)
    if (!next) return

    const badge = document.getElementById('next-prayer-badge')
    const cdHours = document.getElementById('cd-hours')
    const cdMinutes = document.getElementById('cd-minutes')
    const cdSeconds = document.getElementById('cd-seconds')

    if (badge) badge.textContent = next.nameFr

    // Calculate remaining seconds precisely
    const now = new Date()
    const nowTotalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    const prayerMin = timeToMinutes(next.time)
    let prayerTotalSec = prayerMin * 60

    // If prayer is tomorrow (Fajr next day), add 24h
    if (prayerTotalSec <= nowTotalSec && next.minutesUntil > 0) {
      prayerTotalSec += 24 * 3600
    }

    let diff = prayerTotalSec - nowTotalSec
    if (diff < 0) diff += 24 * 3600

    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60

    if (cdHours) cdHours.textContent = String(h).padStart(2, '0')
    if (cdMinutes) cdMinutes.textContent = String(m).padStart(2, '0')
    if (cdSeconds) cdSeconds.textContent = String(s).padStart(2, '0')
  }

  tick() // Initial tick
  countdownInterval = setInterval(tick, 1000)
}

/** Stop the countdown. */
export function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}
