/**
 * onboarding.js — Interactive guided tour (desktop & mobile variants)
 *
 * Desktop: uses tour-highlight class (z-index above overlay) + tour-lift on ancestors
 * Mobile:  uses a fixed-position spotlight ring with box-shadow for dimming
 *          (no overflow/z-index manipulation on content — avoids scroll reset)
 */

import storage from './storage.js'
import { isMobile } from './platform.js'

const desktopTourSteps = [
  {
    title: 'Bienvenue sur GuideME',
    text: 'Découvrez votre nouveau compagnon pour le Ramadan. Commençons par une petite visite guidée !',
    target: null,
    position: 'center',
  },
  {
    title: 'Suivi du Jeûne',
    text: "Voici votre tableau de bord principal. Suivez votre temps de jeûne, l'heure du Suhoor et de l'Iftar d'un seul coup d'œil.",
    target: '.fasting-card',
    position: 'right',
  },
  {
    title: 'Horaires des Prières',
    text: 'Retrouvez ici toutes les prières de la journée. Le code couleur vous aide à repérer la prière en cours et les temps forts.',
    target: '.schedule-card',
    position: 'top',
  },
  {
    title: 'Notifications',
    text: 'Vous pouvez maintenant cliquer sur les cloches de prière du jour pour activer ou désactiver les notifications individuellement.',
    target: '.schedule-card',
    position: 'top',
  },
  {
    title: 'Calendrier Mensuel',
    text: 'Nouveau ! Accédez à tout moment aux horaires complets du mois via ce nouvel onglet, avec une vue claire des jours à venir.',
    target: '#nav-horaires',
    position: 'right',
  },
  {
    title: 'Signaler un Bug',
    text: "Une erreur ou un problème ? N'hésitez pas à nous le signaler via ce bouton pour nous aider à améliorer l'application.",
    target: '#bug-report-btn',
    position: 'right',
  },
  {
    title: 'Thèmes Sahara',
    text: "Passez du jour à la nuit ! Basculez entre le mode clair et sombre ici pour changer l'ambiance du désert en arrière-plan.",
    target: '#theme-toggle',
    position: 'right',
  },
  {
    title: 'Paramètres Avancés',
    text: 'Découvrez nos nouveaux paramètres : recherche de mosquée sur carte, méthodes de calcul avancées et choix complet des Adhans.',
    target: '#settings-btn',
    position: 'right',
  },
]

const mobileTourSteps = [
  {
    title: 'Bienvenue sur GuideME',
    text: 'Votre compagnon pour le Ramadan, maintenant dans votre poche ! Découvrons ensemble les fonctionnalités.',
    target: null,
    position: 'center',
  },
  {
    title: 'Suivi du Jeûne',
    text: "Suivez votre temps de jeûne, l'heure du Suhoor et de l'Iftar en un coup d'œil.",
    target: '.fasting-card',
    position: 'bottom',
  },
  {
    title: 'Horaires des Prières',
    text: 'Toutes les prières du jour avec un code couleur pour repérer la prière en cours.',
    target: '.schedule-card',
    position: 'bottom',
  },
  {
    title: 'Notifications',
    text: 'Appuyez sur les cloches pour activer ou désactiver les rappels de chaque prière.',
    target: '.schedule-card',
    position: 'bottom',
  },
  {
    title: 'Le Menu',
    text: 'Accédez à toutes les fonctionnalités depuis ce bouton : calendrier, paramètres, thème, et plus encore. Vous pouvez aussi glisser depuis le bord gauche.',
    target: '#hamburger-btn',
    position: 'bottom',
  },
  {
    title: 'Boussole Qibla',
    text: 'Retrouvez la direction de la Qibla ici. La boussole utilise les capteurs de votre téléphone pour un guidage en temps réel !',
    target: '#qibla-card',
    position: 'bottom',
  },
]

const tourSteps = isMobile ? mobileTourSteps : desktopTourSteps

let currentStep = 0

/**
 * Start the onboarding tour (only on first visit).
 */
export function initOnboarding() {
  if (storage.get('tourCompleted') === true) return

  const overlay = document.getElementById('onboarding-overlay')
  const btnNext = document.getElementById('btn-next-tour')
  const btnSkip = document.getElementById('btn-skip-tour')

  if (!overlay || !btnNext || !btnSkip) return

  currentStep = 0
  overlay.classList.remove('hidden')
  renderStep()

  btnNext.addEventListener('click', () => {
    if (currentStep < tourSteps.length - 1) {
      currentStep++
      renderStep()
    } else {
      endTour()
    }
  })

  btnSkip.addEventListener('click', endTour)
}

function renderStep() {
  const overlay = document.getElementById('onboarding-overlay')
  const tooltip = overlay.querySelector('.onboarding-tooltip')
  const titleEl = document.getElementById('onboarding-title')
  const textEl = document.getElementById('onboarding-text')
  const btnNext = document.getElementById('btn-next-tour')
  const dotsContainer = overlay.querySelector('.onboarding-dots')

  const step = tourSteps[currentStep]

  titleEl.textContent = step.title
  textEl.textContent = step.text

  // Dots
  dotsContainer.replaceChildren()
  tourSteps.forEach((_, idx) => {
    const dot = document.createElement('span')
    dot.className = `dot ${idx === currentStep ? 'active' : ''}`
    dotsContainer.appendChild(dot)
  })

  // Button text
  btnNext.textContent = currentStep === tourSteps.length - 1 ? 'Terminer' : 'Suivant'

  // Cleanup previous step
  removeSpotlight()
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'))
  document.querySelectorAll('.tour-lift').forEach(el => el.classList.remove('tour-lift'))

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  if (step.target) {
    const el = document.querySelector(step.target)
    if (el) {
      if (isMobile) {
        // ── Mobile: spotlight ring approach ──
        // Overlay becomes transparent — the spotlight's box-shadow provides dimming
        // Also disable backdrop-filter to avoid blurring the content
        overlay.style.background = 'transparent'
        overlay.style.backdropFilter = 'none'
        overlay.style.webkitBackdropFilter = 'none'
        overlay.style.zIndex = '10002'

        // Scroll element into view, then show spotlight once scroll finishes
        scrollToTarget(el, () => {
          showSpotlight(el, isDark)
          positionTooltip(tooltip, el, step.position)
        })
      } else {
        // ── Desktop: original approach ──
        el.classList.add('tour-highlight')
        liftAncestors(el)
        positionTooltip(tooltip, el, step.position)

        overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(11, 43, 27, 0.85)'
        overlay.style.backdropFilter = ''
        overlay.style.webkitBackdropFilter = ''
        overlay.style.zIndex = '9999'
      }
    }
  } else {
    // No target — center tooltip
    tooltip.style.top = '50%'
    tooltip.style.left = '50%'
    tooltip.style.transform = 'translate(-50%, -50%)'

    overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.92)' : 'rgba(11, 43, 27, 0.92)'
    overlay.style.backdropFilter = ''
    overlay.style.webkitBackdropFilter = ''
    overlay.style.zIndex = '9999'
  }
}

// ── Mobile Spotlight ──

/**
 * Create a fixed-position ring around the target element.
 * The ring's massive box-shadow acts as the dimming overlay,
 * leaving a "hole" around the highlighted element.
 *
 * z-index stack:
 *   10001  spotlight ring (border + box-shadow dimming)
 *   10002  overlay (transparent, captures pointer-events) + tooltip
 */
function showSpotlight(el, isDark) {
  removeSpotlight()
  const rect = el.getBoundingClientRect()
  const pad = 6
  const ring = document.createElement('div')
  ring.id = 'tour-spotlight'

  const dimColor = isDark ? 'rgba(0, 0, 0, 0.88)' : 'rgba(11, 43, 27, 0.88)'

  Object.assign(ring.style, {
    position: 'fixed',
    top: `${rect.top - pad}px`,
    left: `${rect.left - pad}px`,
    width: `${rect.width + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
    borderRadius: '16px',
    border: '3px solid var(--clr-gold)',
    zIndex: '10001',
    pointerEvents: 'none',
    boxShadow: `0 0 0 200vmax ${dimColor}, 0 0 20px rgba(212, 175, 55, 0.4)`,
    transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
  })

  document.body.appendChild(ring)
}

function removeSpotlight() {
  const existing = document.getElementById('tour-spotlight')
  if (existing) existing.remove()
}

/**
 * Scroll target into view within .main-content only (not the whole page).
 * Skips fixed-position elements (always visible) and elements already in view.
 * Calls `onDone()` once scroll finishes (or immediately if no scroll needed).
 */
function scrollToTarget(el, onDone) {
  // Fixed elements are always in view
  if (getComputedStyle(el).position === 'fixed') { onDone(); return }

  const rect = el.getBoundingClientRect()
  // Already fully visible — no scroll needed
  if (rect.top >= 60 && rect.bottom <= window.innerHeight - 20) { onDone(); return }

  const container = document.querySelector('.main-content')
  if (!container) { onDone(); return }

  // Scroll within the container to center the element
  const containerRect = container.getBoundingClientRect()
  const elCenterInContainer = rect.top - containerRect.top + rect.height / 2
  const containerCenter = containerRect.height / 2
  const targetScroll = container.scrollTop + elCenterInContainer - containerCenter

  container.scrollTo({ top: targetScroll, behavior: 'smooth' })

  // Poll via rAF until scrollTop stabilises (3 consecutive idle frames)
  let lastTop = container.scrollTop
  let idleFrames = 0
  function check() {
    const top = container.scrollTop
    if (Math.abs(top - lastTop) < 1) {
      idleFrames++
      if (idleFrames >= 3) { onDone(); return }
    } else {
      idleFrames = 0
    }
    lastTop = top
    requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

// ── Desktop: lift ancestor stacking contexts ──

function liftAncestors(el) {
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const cs = getComputedStyle(parent)
    if (
      cs.zIndex !== 'auto' ||
      (cs.backdropFilter && cs.backdropFilter !== 'none') ||
      (cs.transform && cs.transform !== 'none') ||
      (cs.filter && cs.filter !== 'none') ||
      (parseFloat(cs.opacity) < 1)
    ) {
      parent.classList.add('tour-lift')
    }
    parent = parent.parentElement
  }
}

// ── Tooltip Positioning ──

function positionTooltip(tooltip, targetEl, position) {
  const rect = targetEl.getBoundingClientRect()
  const gap = isMobile ? 16 : 24
  let top, left

  tooltip.style.transform = 'none'

  if (isMobile) {
    // On mobile, position below target, centered horizontally
    top = rect.bottom + gap + 6 // extra space for spotlight ring
    left = window.innerWidth / 2 - tooltip.offsetWidth / 2

    // If not enough room below, try above
    if (top + tooltip.offsetHeight > window.innerHeight - 10) {
      top = rect.top - tooltip.offsetHeight - gap - 6
    }
  } else {
    if (position === 'right') {
      top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2
      left = rect.right + gap
      if (left + tooltip.offsetWidth > window.innerWidth) {
        left = rect.left - tooltip.offsetWidth - gap
      }
    } else if (position === 'top') {
      top = rect.top - tooltip.offsetHeight - gap
      left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2
      if (top < 0) top = rect.bottom + gap
    } else if (position === 'bottom') {
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2
    }
  }

  // Clamp horizontal
  if (left < 10) left = 10
  if (left + tooltip.offsetWidth > window.innerWidth - 10) {
    left = window.innerWidth - tooltip.offsetWidth - 10
  }

  // Clamp vertical
  if (top < 10) top = 10
  if (top + tooltip.offsetHeight > window.innerHeight - 10) {
    top = window.innerHeight - tooltip.offsetHeight - 10
  }

  tooltip.style.top = `${top}px`
  tooltip.style.left = `${left}px`
}

// ── End Tour ──

function endTour() {
  const overlay = document.getElementById('onboarding-overlay')
  if (overlay) {
    overlay.classList.add('hidden')
    overlay.style.zIndex = '9999'
    overlay.style.backdropFilter = ''
    overlay.style.webkitBackdropFilter = ''
  }

  removeSpotlight()
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'))
  document.querySelectorAll('.tour-lift').forEach(el => el.classList.remove('tour-lift'))

  storage.set('tourCompleted', true)
}
