/**
 * updater.js — Vérification et installation des mises à jour automatiques
 * Utilise @tauri-apps/plugin-updater pour les mises à jour en arrière-plan.
 * Pattern identique à changelog.js / support.js : getElementById + storage.
 */

import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import storage from './storage.js'
import { isMobile } from './platform.js'

// Intervalle de vérification automatique (4 heures en ms)
const AUTO_CHECK_INTERVAL = 4 * 60 * 60 * 1000
// Délai initial avant le premier check au démarrage (30 secondes)
const STARTUP_DELAY = 30 * 1000

// Mise à jour courante (objet retourné par check())
let pendingUpdate = null

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

// --- Logique principale ---

/**
 * Effectue un check silencieux (pas de modale immédiate).
 * Affiche le badge et prépare la modale "ready" si une mise à jour est disponible.
 * Respecte la version ignorée par l'utilisateur.
 */
async function silentCheck() {
  try {
    storage.set('updater_lastCheck', Date.now())
    const update = await check()

    if (!update || !update.available) {
      // Pas de mise à jour disponible
      pendingUpdate = null
      return
    }

    // Vérifier si l'utilisateur a ignoré cette version
    const dismissed = storage.get('updater_dismissedVersion')
    if (dismissed && dismissed === update.version) {
      return
    }

    // Téléchargement en arrière-plan avec suivi de progression
    pendingUpdate = update
    showBadge()

    // Pré-téléchargement silencieux
    await update.download((event) => {
      // Les événements de progression sont optionnels — on les ignore en mode silencieux
      if (event.event === 'Started') {
        console.log('[updater] Téléchargement démarré, taille :', event.data.contentLength)
      }
    })

    console.log('[updater] Mise à jour', update.version, 'prête à installer')
  } catch (err) {
    // En mode dev le plugin updater peut ne pas être disponible — on ignore silencieusement
    console.warn('[updater] Check silencieux échoué :', err)
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
    storage.set('updater_lastCheck', Date.now())

    // Petite pause visuelle pour que l'état "checking" soit perçu
    await new Promise(resolve => setTimeout(resolve, 600))

    const update = await check()

    if (!update || !update.available) {
      pendingUpdate = null
      showState('uptodate')
      return
    }

    pendingUpdate = update

    // Si déjà pré-téléchargé en mode silencieux, afficher directement "ready"
    // Sinon, télécharger maintenant avec progression visible
    const dismissed = storage.get('updater_dismissedVersion')
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
    displayVersion(`v${update.version}`)
    displayNotes(update.body || null)
    showState('ready')
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
        storage.set('updater_dismissedVersion', pendingUpdate.version)
      }
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

  // Check automatique au démarrage (délai 30s)
  setTimeout(async () => {
    await silentCheck()

    // Puis toutes les 4 heures
    setInterval(silentCheck, AUTO_CHECK_INTERVAL)
  }, STARTUP_DELAY)
}
