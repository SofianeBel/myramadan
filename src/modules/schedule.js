/**
 * schedule.js — Render the daily prayer schedule dynamically
 */

import { timeToMinutes, getCurrentMinutes, getPrayerList } from './prayer-times.js'
import { findNextPrayer } from './countdown.js'

/**
 * Render the prayer schedule into the prayer-list container.
 * @param {Object} timings - Raw timings from API
 */
export function renderPrayerSchedule(timings) {
  const container = document.getElementById('prayer-list')
  if (!container) return

  const prayers = getPrayerList(timings)
  const nowMin = getCurrentMinutes()
  const nextPrayer = findNextPrayer(timings)

  container.innerHTML = ''

  prayers.forEach((prayer, index) => {
    const prayerMin = timeToMinutes(prayer.time)
    const isPassed = prayerMin <= nowMin
    const isFajr = prayer.name === 'Fajr'
    const isMaghrib = prayer.name === 'Maghrib'
    const isNext = nextPrayer && nextPrayer.name === prayer.name

    // Determine if this is the "active" (currently in-progress) prayer
    // Active = the period between this prayer and the next one
    let isActive = false
    if (index < prayers.length - 1) {
      const nextPrayerMin = timeToMinutes(prayers[index + 1].time)
      isActive = nowMin >= prayerMin && nowMin < nextPrayerMin
    } else {
      // Last prayer (Isha) — active from Isha until midnight
      isActive = nowMin >= prayerMin
    }

    // Build CSS classes
    const classes = ['prayer-item']
    if (isPassed && !isActive) classes.push('completed')
    if (isActive) classes.push('active-time')
    if (isFajr) classes.push('highlight-suhoor')
    if (isMaghrib) classes.push('highlight-iftar')
    if (isNext) classes.push('selected')

    const item = document.createElement('div')
    item.className = classes.join(' ')
    item.style.cssText = `--anim-delay: ${0.1 * (index + 1)}s`

    // Bell icon state
    const iconClass = isNext
      ? 'fa-solid fa-bell icon-gold bell-ringing'
      : (isPassed && !isActive)
        ? 'fa-solid fa-check'
        : 'fa-regular fa-bell'

    item.innerHTML = `
      <div class="prayer-info">
        <i class="fa-solid ${prayer.icon} prayer-icon"></i>
        <span class="prayer-name">${prayer.nameFr}</span>
      </div>
      <div class="prayer-time-info">
        <span class="prayer-time">${prayer.time}</span>
        <i class="${iconClass}"></i>
      </div>
    `

    // Click handler for selection
    item.addEventListener('click', () => {
      container.querySelectorAll('.prayer-item').forEach(el => {
        el.classList.remove('selected')
        const icon = el.querySelector('.prayer-time-info > i')
        if (icon && !el.classList.contains('completed')) {
          icon.classList.remove('fa-solid', 'icon-gold', 'bell-ringing')
          icon.classList.add('fa-regular', 'fa-bell')
        }
      })

      item.classList.add('selected')
      const icon = item.querySelector('.prayer-time-info > i')
      if (icon) {
        icon.classList.remove('fa-regular', 'fa-bell')
        icon.classList.add('fa-solid', 'fa-bell', 'icon-gold', 'bell-ringing')
      }
    })

    container.appendChild(item)
  })
}
