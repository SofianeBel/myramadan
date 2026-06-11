// Accessibilité des modales : fermeture Échap, piège à focus (Tab), retour du focus.
// Les modales sont des overlays .onboarding-overlay dont la visibilité est gérée
// par la classe .hidden. La fermeture délègue au bouton d'annulation existant de
// chaque modale pour que la logique propre au module concerné s'exécute.

const FERMETURE_PAR_MODALE = {
  'settings-modal': 'settings-cancel',
  'bug-report-modal': 'bug-cancel',
  'support-modal': 'support-cancel',
  'changelog-modal': 'changelog-close',
  'updater-modal': 'updater-later-btn'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Renvoie l'overlay de modale actuellement visible (le dernier ouvert), ou null */
function modaleVisible() {
  const ouvertes = document.querySelectorAll('.onboarding-overlay:not(.hidden)')
  return ouvertes.length ? ouvertes[ouvertes.length - 1] : null
}

/** Éléments focusables réellement affichés dans l'overlay */
function focusablesVisibles(overlay) {
  return [...overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
}

export function initModalA11y() {
  let dernierFocus = null

  // À l'ouverture : mémorise l'élément actif et déplace le focus dans la modale.
  // À la fermeture : rend le focus à l'élément déclencheur.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const overlay = mutation.target
      if (!overlay.classList || !overlay.classList.contains('onboarding-overlay')) continue
      const estOuverte = !overlay.classList.contains('hidden')
      if (estOuverte) {
        dernierFocus = document.activeElement
        const focusables = focusablesVisibles(overlay)
        if (focusables.length) focusables[0].focus()
      } else if (dernierFocus && document.body.contains(dernierFocus)) {
        dernierFocus.focus()
        dernierFocus = null
      }
    }
  })

  document.querySelectorAll('.onboarding-overlay').forEach((overlay) => {
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] })
  })

  document.addEventListener('keydown', (e) => {
    const overlay = modaleVisible()
    if (!overlay) return

    // Échap ferme la modale via son bouton d'annulation (la logique du module s'applique)
    if (e.key === 'Escape') {
      const btnId = FERMETURE_PAR_MODALE[overlay.id]
      const btn = btnId ? document.getElementById(btnId) : null
      if (btn && btn.offsetParent !== null) {
        e.preventDefault()
        btn.click()
      }
      return
    }

    // Tab reste confiné dans la modale ouverte
    if (e.key === 'Tab') {
      const focusables = focusablesVisibles(overlay)
      if (!focusables.length) return
      const premier = focusables[0]
      const dernier = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
  })
}
