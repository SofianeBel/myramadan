/**
 * daily-content.js — Display daily Quran verse, Hadith, Doua or Sagesse
 *
 * Supports Ramadan mode (filters for ramadan-specific content),
 * transliteration display, category badges, and copy-to-clipboard.
 */

import content from '../data/daily-content.json'

/**
 * Update the quote card with today's content.
 * Selection based on day of year for consistency throughout the day.
 * @param {boolean} isRamadanMode - If true, prefer Ramadan-specific entries
 */
export function updateDailyContent(isRamadanMode = false) {
  const arabicEl = document.getElementById('daily-arabic')
  const translationEl = document.getElementById('daily-translation')
  const transliterationEl = document.getElementById('daily-transliteration')
  const referenceEl = document.getElementById('daily-reference')
  const categoryEl = document.getElementById('daily-category')

  if (!arabicEl || !translationEl || !referenceEl) return
  if (!content || content.length === 0) return

  // Filtrer pour le Ramadan si applicable
  let pool = content
  if (isRamadanMode) {
    const ramadanContent = content.filter(c => c.ramadan)
    if (ramadanContent.length > 0) pool = ramadanContent
  }

  // Sélection basée sur le jour de l'année
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now - start
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)
  const index = dayOfYear % pool.length
  const entry = pool[index]

  arabicEl.textContent = entry.arabic
  translationEl.textContent = entry.translation
  referenceEl.textContent = entry.reference

  if (transliterationEl) {
    transliterationEl.textContent = entry.transliteration || ''
  }

  if (categoryEl) {
    categoryEl.textContent = entry.category || ''
    categoryEl.className = 'daily-category-badge badge-' + (entry.category || 'quran')
  }
}

/**
 * Initialize copy button and other interactive actions on the quote card.
 */
export function initDailyContentActions() {
  const copyBtn = document.getElementById('daily-copy-btn')
  if (!copyBtn) return

  copyBtn.addEventListener('click', () => {
    const arabic = document.getElementById('daily-arabic')?.textContent || ''
    const transliteration = document.getElementById('daily-transliteration')?.textContent || ''
    const translation = document.getElementById('daily-translation')?.textContent || ''
    const reference = document.getElementById('daily-reference')?.textContent || ''

    const text = [arabic, transliteration, translation, reference].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      // Sauvegarder le contenu original du bouton
      const icon = copyBtn.querySelector('i')
      const originalText = copyBtn.lastChild?.textContent || ''

      // Mettre à jour l'icône et le texte
      if (icon) {
        icon.className = 'fa-solid fa-check'
      }
      const textNode = copyBtn.lastChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = ' Copié !'
      }

      setTimeout(() => {
        if (icon) {
          icon.className = 'fa-regular fa-copy'
        }
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = originalText
        }
      }, 2000)
    })
  })
}
