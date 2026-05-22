/**
 * local-date.js — Helpers de dates locales.
 *
 * Ne jamais utiliser toISOString() pour une date calendaire utilisateur :
 * l'UTC peut décaler la journée autour de minuit selon le fuseau horaire.
 */

export function formatLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalDateForAladhan(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}
