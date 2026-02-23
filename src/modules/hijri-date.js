/**
 * hijri-date.js — Display Hijri and Gregorian dates
 */

/**
 * Update date displays from API data.
 * @param {Object|null} hijriDate - Hijri date object from Aladhan API
 */
export function updateDates(hijriDate, offset = 0) {
  const gregorianEl = document.getElementById('gregorian-date')
  const hijriEl = document.getElementById('hijri-date')

  // Gregorian date in French (adjusted by offset)
  if (gregorianEl) {
    const d = new Date()
    if (offset !== 0) d.setDate(d.getDate() + offset)
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    let formatted = d.toLocaleDateString('fr-FR', options)
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1)
    gregorianEl.textContent = formatted
  }

  // Hijri date from API
  if (hijriEl && hijriDate) {
    const day = hijriDate.day
    const month = hijriDate.month?.en || hijriDate.month?.ar || ''
    const year = hijriDate.year
    hijriEl.textContent = `${day} ${month} ${year}`
  }
}
