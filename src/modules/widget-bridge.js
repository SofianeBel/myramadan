/**
 * widget-bridge.js — Pont entre la fenêtre principale et le mini-widget bureau
 *
 * La fenêtre principale possède les données de prière (source de vérité) et les
 * pousse vers le widget via des événements Tauri. Le widget est un affichage passif.
 *
 * Flux d'événements :
 *  - main → widget : 'guideme://timings'        (données de prière + mode)
 *  - widget → main : 'guideme://widget-ready'   (le widget est prêt à recevoir)
 *  - widget → main : 'guideme://widget-hidden'  (l'utilisateur a fermé le widget)
 *  - tray  → main  : 'guideme://toggle-widget'  (bascule depuis le menu tray)
 *
 * Toutes les APIs Tauri sont protégées (try/catch) : en mode dev navigateur,
 * elles n'existent pas et ne doivent pas casser le boot.
 */

import { emitTo, listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import storage from './storage.js'
import { isDesktop, isMobile } from './platform.js'

// Dernier payload publié — réémis quand le widget signale qu'il est prêt
let lastPayload = null

/**
 * Publie les horaires vers le widget (cache + émission).
 * Appelé depuis main.loadPrayerData quand on affiche la date du jour.
 * @param {Object} timings - Horaires bruts (Fajr, Dhuhr, …)
 * @param {string} mode - Mode résolu ('ramadan' | 'normal' | …)
 */
export function publishTimings(timings, mode) {
  lastPayload = { timings, mode }
  if (!isDesktop) return
  try {
    emitTo('widget', 'guideme://timings', lastPayload)
  } catch (err) {
    console.warn('[widget-bridge] publishTimings échec:', err)
  }
}

/**
 * Récupère la fenêtre widget (async en API 2.x).
 * @returns {Promise<WebviewWindow|null>}
 */
async function getWidgetWindow() {
  try {
    return await WebviewWindow.getByLabel('widget')
  } catch (err) {
    console.warn('[widget-bridge] getByLabel échec:', err)
    return null
  }
}

/**
 * Affiche ou masque le widget et persiste l'état dans `widgetEnabled`.
 * La fenêtre peut être masquée tout en gardant son JS actif.
 * @param {boolean} desired - true = afficher, false = masquer
 */
export async function toggleWidget(desired) {
  try {
    const win = await getWidgetWindow()
    if (!win) return
    if (desired) {
      await win.show()
    } else {
      await win.hide()
    }
    storage.set('widgetEnabled', !!desired)
    syncCheckbox(!!desired)
  } catch (err) {
    console.warn('[widget-bridge] toggleWidget échec:', err)
  }
}

/**
 * Bascule l'état actuel du widget (utilisé par le menu tray).
 */
async function toggleWidgetState() {
  try {
    const win = await getWidgetWindow()
    if (!win) return
    const visible = await win.isVisible()
    await toggleWidget(!visible)
  } catch (err) {
    console.warn('[widget-bridge] toggleWidgetState échec:', err)
  }
}

/**
 * Synchronise la case à cocher des paramètres avec l'état réel.
 */
function syncCheckbox(checked) {
  const checkbox = document.getElementById('widget-enabled')
  if (checkbox) checkbox.checked = !!checked
}

/**
 * Initialise le pont widget (bureau uniquement).
 */
export async function initWidgetBridge() {
  if (isMobile) {
    // Pas de widget bureau sur Android : on masque entièrement la ligne de réglage.
    const row = document.getElementById('widget-enabled-row')
    if (row) row.style.display = 'none'
    return
  }

  // Initialise l'état de la case depuis le storage et bind le changement.
  const checkbox = document.getElementById('widget-enabled')
  if (checkbox) {
    checkbox.checked = !!storage.get('widgetEnabled')
    checkbox.addEventListener('change', () => {
      toggleWidget(checkbox.checked)
    })
  }

  try {
    // Le widget signale qu'il est prêt → ré-émet le dernier payload
    // (cas widget lent au boot + rollover de minuit) ; l'auto-show ne dépend
    // PAS de cet événement (race au démarrage : le ready du widget peut partir
    // avant que le main n'écoute).
    await listen('guideme://widget-ready', () => {
      if (lastPayload) {
        try {
          emitTo('widget', 'guideme://timings', lastPayload)
        } catch (err) {
          console.warn('[widget-bridge] réémission timings échec:', err)
        }
      }
    })

    // Bascule depuis le menu tray
    await listen('guideme://toggle-widget', () => {
      toggleWidgetState()
    })

    // L'utilisateur a fermé le widget via son bouton ×
    await listen('guideme://widget-hidden', () => {
      storage.set('widgetEnabled', false)
      syncCheckbox(false)
    })

    // Synchronise le thème du widget en direct (le widget lit le thème au boot uniquement)
    const themeObserver = new MutationObserver(() => {
      const theme = document.documentElement.dataset.theme || 'dark'
      try {
        emitTo('widget', 'guideme://theme', theme)
      } catch (err) {
        console.warn('[widget-bridge] sync thème échec:', err)
      }
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // Auto-show déterministe : ne dépend pas du ready du widget.
    // Le cache storage est chargé et le widget a restauré sa position avant ce point.
    if (storage.get('widgetEnabled')) {
      try {
        const win = await getWidgetWindow()
        if (win) await win.show()
      } catch (err) {
        console.warn('[widget-bridge] auto-show échec:', err)
      }
    }
  } catch (err) {
    console.warn('[widget-bridge] initWidgetBridge échec:', err)
  }
}
