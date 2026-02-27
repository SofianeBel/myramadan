/**
 * onboarding.js — Interactive guided tour (desktop & mobile variants)
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
    text: 'Retrouvez la direction de la Qibla dans le menu. La boussole utilise les capteurs de votre téléphone pour un guidage en temps réel !',
    target: null,
    position: 'center',
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

  // Dots — use DOM methods instead of innerHTML for safety
  dotsContainer.replaceChildren()
  tourSteps.forEach((_, idx) => {
    const dot = document.createElement('span')
    dot.className = `dot ${idx === currentStep ? 'active' : ''}`
    dotsContainer.appendChild(dot)
  })

  // Button text
  btnNext.textContent = currentStep === tourSteps.length - 1 ? 'Terminer' : 'Suivant'

  // Cleanup highlights and lifted/unclipped ancestors
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'))
  document.querySelectorAll('.tour-lift').forEach(el => el.classList.remove('tour-lift'))
  document.querySelectorAll('.tour-unclip').forEach(el => el.classList.remove('tour-unclip'))

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  if (step.target) {
    const el = document.querySelector(step.target)
    if (el) {
      // Scroll the target into view first (elements can be off-screen on mobile)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Wait for scroll to settle, then highlight and position tooltip
      setTimeout(() => {
        el.classList.add('tour-highlight')
        liftAncestors(el)
        positionTooltip(tooltip, el, step.position)
      }, 400)
    }

    overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(11, 43, 27, 0.85)'
  } else {
    // Center tooltip
    tooltip.style.top = '50%'
    tooltip.style.left = '50%'
    tooltip.style.transform = 'translate(-50%, -50%)'

    overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.92)' : 'rgba(11, 43, 27, 0.92)'
  }
}

/**
 * Lift ancestor stacking contexts and unclip overflow containers
 * so the highlighted element is visible above the onboarding overlay.
 *
 * Two distinct classes:
 * - .tour-lift   → parents with z-index/transform/etc → raise z-index to 10001
 * - .tour-unclip → parents with overflow:auto/hidden → set overflow:visible
 *                   (without touching z-index, to avoid pushing entire container
 *                    above the overlay)
 */
function liftAncestors(el) {
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const cs = getComputedStyle(parent)

    // Parents that create stacking contexts → need z-index lift
    if (
      cs.zIndex !== 'auto' ||
      (cs.backdropFilter && cs.backdropFilter !== 'none') ||
      (cs.transform && cs.transform !== 'none') ||
      (cs.filter && cs.filter !== 'none') ||
      (parseFloat(cs.opacity) < 1)
    ) {
      parent.classList.add('tour-lift')
    }

    // Parents that clip overflow → only unclip (no z-index change)
    if (
      cs.overflow === 'auto' || cs.overflow === 'hidden' ||
      cs.overflowY === 'auto' || cs.overflowY === 'hidden'
    ) {
      parent.classList.add('tour-unclip')
    }

    parent = parent.parentElement
  }
}

function positionTooltip(tooltip, targetEl, position) {
  const rect = targetEl.getBoundingClientRect()
  const gap = isMobile ? 16 : 24
  let top, left

  tooltip.style.transform = 'none'

  if (isMobile) {
    // On mobile, always position below the target and center horizontally
    top = rect.bottom + gap
    left = window.innerWidth / 2 - tooltip.offsetWidth / 2

    // If not enough room below, try above
    if (top + tooltip.offsetHeight > window.innerHeight - 10) {
      top = rect.top - tooltip.offsetHeight - gap
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

  // Clamp vertical: keep tooltip within viewport
  if (top < 10) top = 10
  if (top + tooltip.offsetHeight > window.innerHeight - 10) {
    top = window.innerHeight - tooltip.offsetHeight - 10
  }

  tooltip.style.top = `${top}px`
  tooltip.style.left = `${left}px`
}

function endTour() {
  const overlay = document.getElementById('onboarding-overlay')
  if (overlay) overlay.classList.add('hidden')

  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'))
  document.querySelectorAll('.tour-lift').forEach(el => el.classList.remove('tour-lift'))
  document.querySelectorAll('.tour-unclip').forEach(el => el.classList.remove('tour-unclip'))

  storage.set('tourCompleted', true)
}
