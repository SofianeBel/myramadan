/**
 * date-navigation.js — Navigate between dates for prayer times
 *
 * Manages date offset state and wires up the .date-selector UI.
 */

const MAX_OFFSET = 30
const DEBOUNCE_MS = 300

let currentOffset = 0
let debounceTimer = null

/** Return current offset (days from today, negative = past) */
export function getOffset() {
  return currentOffset
}

/** Return a JS Date for the current offset */
export function getOffsetDate() {
  const d = new Date()
  d.setDate(d.getDate() + currentOffset)
  return d
}

/** Return 'YYYY-MM-DD' string for the current offset (cache keys, local time) */
export function getOffsetDateString() {
  const d = getOffsetDate()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Return 'DD-MM-YYYY' for use in Aladhan URL path */
export function getOffsetDateForAladhan() {
  const d = getOffsetDate()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/** Human-readable French label for current offset */
export function getDateLabel() {
  if (currentOffset === 0) return 'Aujourd\'hui'
  if (currentOffset === -1) return 'Hier'
  if (currentOffset === 1) return 'Demain'
  const d = getOffsetDate()
  const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Initialize DOM wiring for the .date-selector.
 * @param {Function} onDateChange - Async callback(offset) called when user navigates.
 */
export function initDateNavigation(onDateChange) {
  const selector = document.querySelector('.date-selector')
  if (!selector) return

  const prevBtn = document.getElementById('nav-prev')
  const label = selector.querySelector('span')
  const nextBtn = document.getElementById('nav-next')

  if (!prevBtn || !label || !nextBtn) return

  function updateUI() {
    label.textContent = getDateLabel()

    // Disable/enable chevrons at boundaries
    prevBtn.classList.toggle('nav-disabled', currentOffset <= -MAX_OFFSET)
    nextBtn.classList.toggle('nav-disabled', currentOffset >= MAX_OFFSET)

    // Allow clicking label to jump back to today when off today
    if (currentOffset !== 0) {
      label.classList.add('nav-today-link')
      label.title = 'Revenir à aujourd\'hui'
    } else {
      label.classList.remove('nav-today-link')
      label.title = ''
    }
  }

  function debouncedDateChange(offset) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => onDateChange(offset), DEBOUNCE_MS)
  }

  prevBtn.addEventListener('click', () => {
    if (currentOffset <= -MAX_OFFSET) return
    currentOffset--
    updateUI()
    debouncedDateChange(currentOffset)
  })

  nextBtn.addEventListener('click', () => {
    if (currentOffset >= MAX_OFFSET) return
    currentOffset++
    updateUI()
    debouncedDateChange(currentOffset)
  })

  // Click on date label resets to today
  label.addEventListener('click', () => {
    if (currentOffset === 0) return
    currentOffset = 0
    updateUI()
    debouncedDateChange(0)
  })

  updateUI()
}
