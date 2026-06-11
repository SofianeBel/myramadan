/**
 * widget.js — Point d'entrée de la fenêtre mini-widget bureau
 *
 * Affichage passif piloté par la fenêtre principale. Reçoit les horaires via
 * l'événement 'guideme://timings', calcule localement le compte à rebours et
 * (en Ramadan) la barre de jeûne.
 *
 * Règles critiques :
 *  - Le widget n'écrit QUE la clé `widgetPosition`. Son cache mémoire est
 *    indépendant de celui du main : écrire une clé du main corromprait sa valeur
 *    (cache stale). Les lectures (theme) au boot sont sûres.
 *  - Aucun script inline (CSP stricte). Pas d'import de style.css ni FontAwesome.
 */

import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window'
import { emit, listen } from '@tauri-apps/api/event'
import storage from './modules/storage.js'
import { findNextPrayer } from './modules/countdown.js'
import { timeToMinutes, getCurrentMinutes } from './modules/prayer-times.js'

// Payload courant { timings, mode } + intervalle de tick local
let payload = null
let tickInterval = null
let midnightTimeout = null
let moveDebounce = null

// ─── Rendu du compte à rebours (réplique locale de startCountdown) ───

/**
 * Met à jour les ids du widget (#w-prayer, #w-h/m/s) pour le prochain prière.
 * On ne réutilise PAS startCountdown : il cible les ids de la fenêtre principale.
 */
function renderTick() {
  if (!payload || !payload.timings) return
  const timings = payload.timings

  const next = findNextPrayer(timings)
  if (!next) return

  const prayerEl = document.getElementById('w-prayer')
  const hEl = document.getElementById('w-h')
  const mEl = document.getElementById('w-m')
  const sEl = document.getElementById('w-s')

  if (prayerEl) prayerEl.textContent = next.nameFr

  // Secondes restantes précises (même logique que countdown.js)
  const now = new Date()
  const nowTotalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const prayerMin = timeToMinutes(next.time)
  let prayerTotalSec = prayerMin * 60

  if (prayerTotalSec <= nowTotalSec && next.minutesUntil > 0) {
    prayerTotalSec += 24 * 3600
  }

  let diff = prayerTotalSec - nowTotalSec
  if (diff < 0) diff += 24 * 3600

  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60

  if (hEl) hEl.textContent = String(h).padStart(2, '0')
  if (mEl) mEl.textContent = String(m).padStart(2, '0')
  if (sEl) sEl.textContent = String(s).padStart(2, '0')

  renderFasting()
}

/**
 * Barre de jeûne : visible uniquement en Ramadan, basée sur Fajr → Maghrib.
 */
function renderFasting() {
  const fastingEl = document.getElementById('w-fasting')
  const fillEl = document.getElementById('w-fasting-fill')
  if (!fastingEl || !fillEl) return

  const timings = payload?.timings
  const isRamadan = payload?.mode === 'ramadan'

  if (!isRamadan || !timings || !timings.Fajr || !timings.Maghrib) {
    fastingEl.classList.add('hidden')
    return
  }

  const fajrMin = timeToMinutes(timings.Fajr)
  const maghribMin = timeToMinutes(timings.Maghrib)
  const nowMin = getCurrentMinutes()

  if (!Number.isFinite(fajrMin) || !Number.isFinite(maghribMin) || maghribMin <= fajrMin) {
    fastingEl.classList.add('hidden')
    return
  }

  fastingEl.classList.remove('hidden')

  let pct = 0
  if (nowMin >= maghribMin) {
    pct = 100
  } else if (nowMin > fajrMin) {
    pct = Math.min(100, Math.max(0, Math.round(((nowMin - fajrMin) / (maghribMin - fajrMin)) * 100)))
  }
  fillEl.style.width = `${pct}%`
}

/**
 * Reçoit un nouveau payload et (re)démarre le tick local 1 s.
 */
function onTimings(event) {
  payload = event.payload || null
  renderTick()
  if (tickInterval) clearInterval(tickInterval)
  tickInterval = setInterval(renderTick, 1000)
}

// ─── Rollover de minuit ───

/**
 * Programme une réémission de 'widget-ready' juste après minuit, pour que le
 * main renvoie le dernier payload (le main non plus ne refetch pas à minuit).
 */
function armMidnightRollover() {
  if (midnightTimeout) clearTimeout(midnightTimeout)
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 10, 0)
  const delay = Math.max(1000, next.getTime() - now.getTime())
  midnightTimeout = setTimeout(async () => {
    try {
      await emit('guideme://widget-ready')
    } catch (err) {
      console.warn('[widget] réémission ready (minuit) échec:', err)
    }
    armMidnightRollover()
  }, delay)
}

// ─── Persistance de la position ───

/**
 * Sauvegarde la position de la fenêtre (debounce 500 ms).
 * Le widget n'écrit JAMAIS d'autre clé que widgetPosition.
 */
async function setupPositionPersistence() {
  try {
    const win = getCurrentWindow()
    await win.onMoved(({ payload: pos }) => {
      if (moveDebounce) clearTimeout(moveDebounce)
      moveDebounce = setTimeout(() => {
        storage.set('widgetPosition', { x: pos.x, y: pos.y })
      }, 500)
    })
  } catch (err) {
    console.warn('[widget] onMoved indisponible:', err)
  }
}

// ─── Bouton de fermeture ───

function setupCloseButton() {
  const closeBtn = document.getElementById('w-close')
  if (!closeBtn) return
  closeBtn.addEventListener('click', async () => {
    try {
      await getCurrentWindow().hide()
      await emit('guideme://widget-hidden')
    } catch (err) {
      console.warn('[widget] fermeture échec:', err)
    }
  })
}

// ─── Boot ───

async function boot() {
  // 1. Storage (lecture seule pour le thème — le main possède les autres clés)
  try {
    await storage.init()
  } catch (err) {
    console.warn('[widget] storage.init échec:', err)
  }

  // 2. Thème depuis le storage (défaut dark)
  document.documentElement.dataset.theme = storage.get('theme') || 'dark'

  // 3. Restaure la position sauvegardée (avant le show du main → pas de flash)
  try {
    const pos = storage.get('widgetPosition')
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      await getCurrentWindow().setPosition(new PhysicalPosition(pos.x, pos.y))
    }
  } catch (err) {
    console.warn('[widget] restauration position échec:', err)
  }

  // 4. Bouton fermer + persistance position
  setupCloseButton()
  await setupPositionPersistence()

  // 5. Écoute les horaires poussés par le main
  try {
    await listen('guideme://timings', onTimings)
  } catch (err) {
    console.warn('[widget] listen timings échec:', err)
  }

  // 5b. Écoute les changements de thème en direct depuis le main
  try {
    await listen('guideme://theme', (event) => {
      document.documentElement.dataset.theme = event.payload || 'dark'
    })
  } catch (err) {
    console.warn('[widget] listen thème échec:', err)
  }

  // 6. Rollover minuit
  armMidnightRollover()

  // 7. Signale au main qu'on est prêt (le main fait le show après ready → pas de flash)
  try {
    await emit('guideme://widget-ready')
  } catch (err) {
    console.warn('[widget] emit ready échec:', err)
  }
}

boot()
