/**
 * sanitize.js — Fonctions de sanitization pour les donnees externes
 */

/**
 * Echappe les caracteres HTML dangereux pour prevenir les injections XSS.
 * @param {string} str - Chaine a echapper
 * @returns {string} Chaine echappee
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Valide qu'un slug Mawaqit est bien forme (alphanum + tirets uniquement).
 * @param {string} slug - Slug a valider
 * @returns {boolean}
 */
export function isValidSlug(slug) {
  if (typeof slug !== 'string') return false
  return /^[a-z0-9-]+$/i.test(slug)
}
