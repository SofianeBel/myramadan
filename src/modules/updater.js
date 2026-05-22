/**
 * updater.js — Vérification et installation des mises à jour automatiques
 * Utilise @tauri-apps/plugin-updater pour les mises à jour en arrière-plan.
 * Pattern identique à changelog.js / support.js : getElementById + storage.
 */

import { check } from '@tauri-apps/plugin-updater'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { relaunch } from '@tauri-apps/plugin-process'
import storage from './storage.js'
import { isMobile } from './platform.js'

// Intervalle de vérification automatique (4 heures en ms)
const AUTO_CHECK_INTERVAL = 4 * 60 * 60 * 1000
// Délai court pour laisser l'interface se stabiliser avant le check au démarrage
const STARTUP_DELAY = 3 * 1000
const LAST_CHECK_KEY = 'updater_lastCheck'
const DISMISSED_VERSION_KEY = 'updater_dismissedVersion'
const NOTIFIED_VERSION_KEY = 'updater_notifiedVersion'

// Mise à jour courante (objet retourné par check())
let pendingUpdate = null
let automaticCheckRunning = false
let startupTimer = null
let periodicTimer = null
let toastVersionShown = null

// --- Utilitaires DOM ---

function showState(stateName) {
  const states = ['checking', 'ready', 'error', 'uptodate']
  states.forEach(s => {
    const el = document.getElementById(`updater-state-${s}`)
    if (el) el.classList.toggle('hidden', s !== stateName)
  })
}

function openModal() {
  const modal = document.getElementById('updater-modal')
  if (modal) modal.classList.remove('hidden')
}

function closeModal() {
  const modal = document.getElementById('updater-modal')
  if (modal) modal.classList.add('hidden')
}

function setProgress(percent, text) {
  const fill = document.getElementById('updater-progress-fill')
  const label = document.getElementById('updater-progress-text')
  if (fill) fill.style.width = `${percent}%`
  if (label) label.textContent = text || `${percent}%`
}

function showBadge() {
  const badge = document.getElementById('updater-badge')
  if (badge) badge.style.display = ''
}

function hideBadge() {
  const badge = document.getElementById('updater-badge')
  if (badge) badge.style.display = 'none'
}

function displayVersion(version) {
  const el = document.getElementById('updater-version')
  if (el) el.textContent = version || ''
}

function displayNotes(notes) {
  const el = document.getElementById('updater-notes')
  if (!el) return
  if (!notes) {
    el.textContent = ''
    return
  }
  // Affichage texte brut des notes de version
  el.textContent = notes
}

function displayError(msg) {
  const el = document.getElementById('updater-error-msg')
  if (el) el.textContent = msg || 'Une erreur inattendue est survenue.'
}

function isUpdateAvailable(update) {
  return Boolean(update && update.available !== false)
}

function displayReady(update) {
  displayVersion(update?.version ? `v${update.version}` : '')
  displayNotes(update?.body || null)
  showState('ready')
}

function showUpdateToast(update) {
  if (!update?.version || toastVersionShown === update.version) return

  toastVersionShown = update.version

  const existing = document.getElementById('updater-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'updater-toast'
  toast.className = 'auto-select-toast updater-toast'

  const icon = document.createElement('i')
  icon.className = 'fa-solid fa-download'
  toast.appendChild(icon)

  const textContainer = document.createElement('div')
  textContainer.className = 'auto-select-toast-text'

  const title = document.createElement('div')
  title.className = 'auto-select-toast-title'
  title.textContent = 'Mise à jour disponible'
  textContainer.appendChild(title)

  const subtitle = document.createElement('div')
  subtitle.className = 'auto-select-toast-subtitle'
  subtitle.textContent = `GuideME v${update.version} est prêt à installer`
  textContainer.appendChild(subtitle)

  toast.appendChild(textContainer)

  const openBtn = document.createElement('button')
  openBtn.className = 'auto-select-toast-btn'
  openBtn.textContent = 'Voir'
  openBtn.addEventListener('click', () => {
    toast.remove()
    openModal()
    displayReady(update)
  })
  toast.appendChild(openBtn)

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
    if (toast.parentNode) {
      toast.classList.add('toast-exit')
      setTimeout(() => toast.remove(), 300)
    }
  }, 10000)
}

async function ensureNotificationPermission() {
  try {
    let granted = await isPermissionGranted()
    if (!granted) {
      const result = await requestPermission()
      granted = result === 'granted'
    }
    return granted
  } catch (err) {
    console.warn('[updater] Permission notification indisponible :', err)
    return false
  }
}

async function notifyUpdateReady(update) {
  if (!update?.version) return
  if (storage.get(NOTIFIED_VERSION_KEY) === update.version) return

  const granted = await ensureNotificationPermission()
  if (!granted) return

  try {
    sendNotification({
      title: 'Mise à jour GuideME disponible',
      body: `La version ${update.version} est prête à installer.`,
    })
    storage.set(NOTIFIED_VERSION_KEY, update.version)
  } catch (err) {
    console.warn('[updater] Notification de mise à jour échouée :', err)
  }
}

// --- Logique principale ---

/**
 * Effectue un check silencieux (pas de modale immédiate).
 * Affiche le badge et prépare la modale "ready" si une mise à jour est disponible.
 * Respecte la version ignorée par l'utilisateur.
 */
async function silentCheck() {
  if (automaticCheckRunning) return
  automaticCheckRunning = true

  try {
    storage.set(LAST_CHECK_KEY, Date.now())
    const update = await check()

    if (!isUpdateAvailable(update)) {
      // Pas de mise à jour disponible
      pendingUpdate = null
      hideBadge()
      return
    }

    // Vérifier si l'utilisateur a ignoré cette version
    const dismissed = storage.get(DISMISSED_VERSION_KEY)
    if (dismissed && dismissed === update.version) {
      pendingUpdate = null
      hideBadge()
      return
    }

    // Pré-téléchargement silencieux : la mise à jour devient actionnable seulement après.
    await update.download((event) => {
      // Les événements de progression sont optionnels — on les ignore en mode silencieux
      if (event.event === 'Started') {
        console.log('[updater] Téléchargement démarré, taille :', event.data.contentLength)
      }
    })

    pendingUpdate = update
    showBadge()
    console.log('[updater] Mise à jour', update.version, 'prête à installer')
    displayReady(update)
    showUpdateToast(update)
    await notifyUpdateReady(update)
  } catch (err) {
    // En mode dev le plugin updater peut ne pas être disponible — on ignore silencieusement
    console.warn('[updater] Check silencieux échoué :', err)
  } finally {
    automaticCheckRunning = false
  }
}

/**
 * Effectue un check manuel (ouvert par l'utilisateur via la sidebar).
 * Affiche la modale immédiatement avec l'état "checking".
 */
async function manualCheck() {
  openModal()
  showState('checking')
  setProgress(0, '0%')

  try {
    storage.set(LAST_CHECK_KEY, Date.now())

    // Petite pause visuelle pour que l'état "checking" soit perçu
    await new Promise(resolve => setTimeout(resolve, 600))

    const update = await check()

    if (!isUpdateAvailable(update)) {
      pendingUpdate = null
      hideBadge()
      showState('uptodate')
      return
    }

    pendingUpdate = update

    // Si déjà pré-téléchargé en mode silencieux, afficher directement "ready"
    // Sinon, télécharger maintenant avec progression visible
    const dismissed = storage.get(DISMISSED_VERSION_KEY)
    if (dismissed && dismissed === update.version) {
      // L'utilisateur a ignoré cette version mais a relancé un check manuel — on la propose quand même
    }

    // Afficher l'état "checking" avec progression pendant le téléchargement
    let downloaded = 0
    let total = 0

    await update.download((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength || 0
        setProgress(0, '0%')
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength || 0
        if (total > 0) {
          const pct = Math.round((downloaded / total) * 100)
          setProgress(pct, `${pct}%`)
        }
      } else if (event.event === 'Finished') {
        setProgress(100, '100%')
      }
    })

    // Prêt à installer
    showBadge()
    displayReady(update)
  } catch (err) {
    console.error('[updater] Check manuel échoué :', err)
    displayError(err?.message || String(err))
    showState('error')
  }
}

// --- Initialisation ---

export async function initUpdater() {
  if (isMobile) return // Play Store handles updates on mobile

  const btn = document.getElementById('updater-btn')
  const modal = document.getElementById('updater-modal')

  if (!modal) return

  // Bouton sidebar → check manuel
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      if (pendingUpdate) {
        openModal()
        displayReady(pendingUpdate)
        return
      }
      manualCheck()
    })
  }

  // Bouton fermer (X)
  const closeBtn = document.getElementById('updater-close')
  if (closeBtn) closeBtn.addEventListener('click', closeModal)

  // Fermer en cliquant sur l'overlay
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  // Bouton "Installer et redémarrer"
  const installBtn = document.getElementById('updater-install-btn')
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!pendingUpdate) return
      try {
        await pendingUpdate.install()
        await relaunch()
      } catch (err) {
        console.error('[updater] Erreur installation :', err)
        displayError(err?.message || String(err))
        showState('error')
      }
    })
  }

  // Bouton "Plus tard" — ignorer cette version
  const laterBtn = document.getElementById('updater-later-btn')
  if (laterBtn) {
    laterBtn.addEventListener('click', async () => {
      if (pendingUpdate) {
        storage.set(DISMISSED_VERSION_KEY, pendingUpdate.version)
      }
      pendingUpdate = null
      document.getElementById('updater-toast')?.remove()
      hideBadge()
      closeModal()
    })
  }

  // Bouton "Réessayer"
  const retryBtn = document.getElementById('updater-retry-btn')
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      manualCheck()
    })
  }

  // Bouton "Fermer" (état erreur)
  const closeErrorBtn = document.getElementById('updater-close-error')
  if (closeErrorBtn) closeErrorBtn.addEventListener('click', closeModal)

  // Bouton "Fermer" (état up-to-date)
  const closeUptodateBtn = document.getElementById('updater-close-uptodate')
  if (closeUptodateBtn) closeUptodateBtn.addEventListener('click', closeModal)

  // Check automatique au démarrage, puis toutes les 4 heures.
  if (startupTimer) clearTimeout(startupTimer)
  if (periodicTimer) clearInterval(periodicTimer)

  startupTimer = setTimeout(() => {
    silentCheck()
  }, STARTUP_DELAY)

  periodicTimer = setInterval(silentCheck, AUTO_CHECK_INTERVAL)
}
