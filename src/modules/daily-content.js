/**
 * daily-content.js — Display daily Quran verse or Hadith
 */

import content from '../data/daily-content.json'

/**
 * Update the quote card with today's content.
 * Selection based on day of year for consistency throughout the day.
 */
export function updateDailyContent() {
  const arabicEl = document.getElementById('daily-arabic')
  const translationEl = document.getElementById('daily-translation')
  const referenceEl = document.getElementById('daily-reference')

  if (!arabicEl || !translationEl || !referenceEl) return
  if (!content || content.length === 0) return

  // Pick entry based on day of year
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now - start
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)
  const index = dayOfYear % content.length

  const entry = content[index]

  arabicEl.textContent = entry.arabic
  translationEl.textContent = entry.translation
  referenceEl.textContent = entry.reference
}
