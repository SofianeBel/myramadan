/**
 * backup.js — Export / Import des données utilisateur (onglet « Données »)
 *
 * Sauvegarde les données personnelles (suivi, journal, objectifs, mosquée…)
 * dans un fichier JSON enveloppé, et permet de les réimporter (remplacement total).
 *
 * Sécurité / robustesse :
 * - Seules les clés de la whitelist EXPORT_KEYS sont exportées (jamais les caches).
 * - validateImport() vérifie l'enveloppe et la forme de chaque clé (skip si invalide).
 * - L'import écrase les données puis recharge la page (await storage.flush() obligatoire
 *   avant location.reload(), sinon les writes fire-and-forget sont perdus).
 */

import { save, open, ask } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import storage from './storage.js'
import { APP_VERSION } from './changelog.js'
import { isMobile } from './platform.js'

// Version du schéma de la sauvegarde — incrémenter si la forme des données change
export const SCHEMA_VERSION = 1

const APP_ID = 'guideme-ramadan'

// Whitelist : uniquement les données utilisateur réelles, jamais les caches ni l'état machine.
// EXCLUS volontairement : mawaqitCache, mawaqitCalendarCache, prayerTimesCache, lastSeenVersion,
// updater_* , __migrated_from_localstorage__, widgetPosition, lastExportDate
export const EXPORT_KEYS = [
  'practiceLog', 'journal', 'goals', 'dhikrState', 'duaFavorites', 'khatmPlan',
  'notificationPrefs', 'appMode', 'theme', 'widgetEnabled',
  'mosqueSlug', 'mosqueName', 'userCity', 'userCountry', 'userLat', 'userLon',
  'calculationMethod', 'mosqueAutoDetected',
  'tourCompleted', 'sidebar_minimized', 'support_interacted',
]

// ─── Validateurs de forme (légers) par clé ───

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isString = (v) => typeof v === 'string'
const isBool = (v) => typeof v === 'boolean'
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const isArray = (v) => Array.isArray(v)

// Coordonnée : nombre fini OU chaîne non-vide convertible en nombre fini.
// Mawaqit livre des coords sous forme de strings ('45.75') → on reflète la
// sémantique de getStoredCoords (qibla.js) : on rejette null, les chaînes vides
// ou blanches et les chaînes non numériques, sinon Number() + Number.isFinite.
const isCoordinate = (v) => {
  if (typeof v === 'string' && v.trim() === '') return false
  return Number.isFinite(Number(v))
}

// practiceLog : objet dont chaque valeur est un objet (date → entrée)
const isObjectOfObjects = (v) => isPlainObject(v) && Object.values(v).every(isPlainObject)
// journal : objet dont chaque valeur est une string (date → texte)
const isObjectOfStrings = (v) => isPlainObject(v) && Object.values(v).every(isString)

const VALIDATORS = {
  practiceLog: isObjectOfObjects,
  journal: isObjectOfStrings,
  goals: isArray,
  dhikrState: isPlainObject,
  duaFavorites: isArray,
  khatmPlan: isPlainObject,
  notificationPrefs: isPlainObject,
  appMode: (v) => v === 'auto' || v === 'ramadan' || v === 'normal',
  theme: (v) => v === 'dark' || v === 'light',
  widgetEnabled: isBool,
  mosqueSlug: isString,
  mosqueName: isString,
  userCity: isString,
  userCountry: isString,
  userLat: isCoordinate,
  userLon: isCoordinate,
  calculationMethod: (v) => isString(v) || isNumber(v),
  mosqueAutoDetected: isBool,
  tourCompleted: isBool,
  sidebar_minimized: isBool,
  support_interacted: isBool,
}

// ─── Helpers ───

// Clé de date locale (jamais toISOString — décalage UTC après minuit)
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Construit l'enveloppe d'export : uniquement les clés whitelist non nulles.
 * @returns {{ app: string, schemaVersion: number, appVersion: string, exportedAt: string, data: Object }}
 */
export function buildExport() {
  const data = {}
  for (const key of EXPORT_KEYS) {
    const value = storage.get(key)
    if (value !== null && value !== undefined) {
      data[key] = value
    }
  }
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

/**
 * Valide une sauvegarde parsée (fonction pure).
 * @param {*} parsed Objet issu de JSON.parse
 * @returns {{ ok: boolean, errors: string[], warnings: string[], data: Object }}
 */
export function validateImport(parsed) {
  const errors = []
  const warnings = []
  const data = {}

  if (!isPlainObject(parsed)) {
    return { ok: false, errors: ['Fichier de sauvegarde invalide.'], warnings, data }
  }

  if (parsed.app !== APP_ID) {
    errors.push('Ce fichier n’est pas une sauvegarde GuideME Ramadan.')
  }

  const version = parsed.schemaVersion
  if (!Number.isInteger(version) || version < 1) {
    // version absente / non entière / < 1 → fichier corrompu, pas « plus récent »
    errors.push('Sauvegarde invalide (version de schéma manquante ou corrompue).')
  } else if (version > SCHEMA_VERSION) {
    errors.push('Fichier issu d’une version plus récente de l’application.')
  }

  const rawData = isPlainObject(parsed.data) ? parsed.data : {}

  for (const [key, value] of Object.entries(rawData)) {
    if (!EXPORT_KEYS.includes(key)) {
      warnings.push(`Clé inconnue ignorée : ${key}`)
      continue
    }
    const validator = VALIDATORS[key]
    if (validator && !validator(value)) {
      warnings.push(`Donnée ignorée (format invalide) : ${key}`)
      continue
    }
    data[key] = value
  }

  const ok = errors.length === 0 && Object.keys(data).length > 0
  return { ok, errors, warnings, data }
}

/**
 * Résume le contenu validé pour la confirmation utilisateur (fonction pure).
 * @param {Object} data Données validées (issues de validateImport)
 * @returns {{ practiceDays: number, journalEntries: number, mosqueName: (string|null) }}
 */
export function summarizeImport(data) {
  const practiceLog = data.practiceLog
  const journal = data.journal
  return {
    practiceDays: isPlainObject(practiceLog) ? Object.keys(practiceLog).length : 0,
    journalEntries: isPlainObject(journal) ? Object.keys(journal).length : 0,
    mosqueName: isString(data.mosqueName) ? data.mosqueName : null,
  }
}

// ─── UI helpers ───

// Toast de succès (mirroir léger de showAutoSelectToast dans main.js — pas d'import croisé)
function showSuccessToast(message) {
  const toast = document.createElement('div')
  toast.className = 'auto-select-toast'

  const icon = document.createElement('i')
  icon.className = 'fa-solid fa-circle-check'
  toast.appendChild(icon)

  const textContainer = document.createElement('div')
  textContainer.className = 'auto-select-toast-text'
  const title = document.createElement('div')
  title.className = 'auto-select-toast-title'
  title.textContent = message
  textContainer.appendChild(title)
  toast.appendChild(textContainer)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'auto-select-toast-close'
  const closeIcon = document.createElement('i')
  closeIcon.className = 'fa-solid fa-xmark'
  closeBtn.appendChild(closeIcon)
  closeBtn.addEventListener('click', () => {
    toast.classList.add('toast-exit')
    setTimeout(() => toast.remove(), 300)
  })
  toast.appendChild(closeBtn)

  document.body.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('toast-visible'))
  setTimeout(() => {
    toast.classList.add('toast-exit')
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

// Affiche un message inline dans la zone de statut de l'onglet Données
function showStatus(message, isError) {
  const statusEl = document.getElementById('backup-status')
  if (!statusEl) return
  statusEl.textContent = message
  statusEl.classList.remove('hidden')
  statusEl.classList.toggle('backup-status-error', !!isError)
  statusEl.classList.toggle('backup-status-ok', !isError)
}

function clearStatus() {
  const statusEl = document.getElementById('backup-status')
  if (!statusEl) return
  statusEl.textContent = ''
  statusEl.classList.add('hidden')
}

// Met à jour l'affichage de la date de dernier export
function updateLastExportLabel() {
  const el = document.getElementById('backup-last-export')
  if (!el) return
  const iso = storage.get('lastExportDate')
  if (!iso) {
    el.textContent = 'jamais'
    return
  }
  try {
    const d = new Date(iso)
    el.textContent = d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    el.textContent = 'jamais'
  }
}

// ─── Actions ───

/**
 * Exporte les données vers un fichier JSON choisi par l'utilisateur.
 */
export async function exportData() {
  clearStatus()
  try {
    let path = await save({
      defaultPath: `guideme-backup-${todayKey()}.json`,
      filters: [{ name: 'Sauvegarde GuideME', extensions: ['json'] }],
    })

    if (!path) return // annulé par l'utilisateur

    if (!path.toLowerCase().endsWith('.json')) {
      path = `${path}.json`
    }

    const envelope = buildExport()
    await writeTextFile(path, JSON.stringify(envelope, null, 2))

    const iso = new Date().toISOString()
    storage.set('lastExportDate', iso)
    updateLastExportLabel()
    showSuccessToast('Sauvegarde exportée avec succès')
  } catch (err) {
    console.error('[backup] Export error:', err)
    showStatus('Impossible d’exporter la sauvegarde.', true)
  }
}

/**
 * Importe une sauvegarde depuis un fichier JSON (remplacement total + reload).
 */
export async function importData() {
  clearStatus()
  try {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Sauvegarde GuideME', extensions: ['json'] }],
    })

    if (!path) return // annulé par l'utilisateur

    const filePath = Array.isArray(path) ? path[0] : path

    let raw
    try {
      raw = await readTextFile(filePath)
    } catch (err) {
      console.error('[backup] Read error:', err)
      showStatus('Fichier illisible.', true)
      return
    }

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      showStatus('Fichier illisible.', true)
      return
    }

    const result = validateImport(parsed)
    if (!result.ok) {
      const msg = result.errors[0] || 'Sauvegarde invalide ou vide.'
      showStatus(msg, true)
      return
    }

    const summary = summarizeImport(result.data)
    const confirmed = await ask(
      `${summary.practiceDays} jours de suivi et ${summary.journalEntries} entrées de journal seront remplacés. Continuer ?`,
      { title: 'Importer la sauvegarde', kind: 'warning' }
    )

    if (!confirmed) return

    for (const [key, value] of Object.entries(result.data)) {
      storage.set(key, value)
    }

    // Obligatoire : forcer l'écriture disque avant le reload (writes fire-and-forget sinon perdus)
    await storage.flush()

    // Recharge tout : thème, khatm rollup, etc. réappliqués au boot
    location.reload()
  } catch (err) {
    console.error('[backup] Import error:', err)
    showStatus('Impossible d’importer la sauvegarde.', true)
  }
}

/**
 * Initialise l'onglet Données : bind les boutons, affiche la date de dernier export,
 * et cache entièrement l'onglet sur mobile (pas de plugin dialog/fs côté Android).
 */
export function initBackup() {
  // Sur mobile : cacher le bouton d'onglet entièrement
  if (isMobile) {
    const tabBtn = document.querySelector('.settings-tab[data-tab="data"]')
    if (tabBtn) tabBtn.style.display = 'none'
    return
  }

  updateLastExportLabel()

  const exportBtn = document.getElementById('backup-export-btn')
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData)
  }

  const importBtn = document.getElementById('backup-import-btn')
  if (importBtn) {
    importBtn.addEventListener('click', importData)
  }
}
