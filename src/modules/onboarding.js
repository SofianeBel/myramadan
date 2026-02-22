/**
 * onboarding.js — Interactive guided tour (4 steps)
 */

const tourSteps = [
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
    title: 'Thèmes Sahara',
    text: "Passez du jour à la nuit ! Basculez entre le mode clair et sombre ici pour changer l'ambiance du désert en arrière-plan.",
    target: '#theme-toggle',
    position: 'right',
  },
]

let currentStep = 0

/**
 * Start the onboarding tour (only on first visit).
 */
export function initOnboarding() {
  if (localStorage.getItem('tourCompleted') === 'true') return

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
  dotsContainer.innerHTML = ''
  tourSteps.forEach((_, idx) => {
    const dot = document.createElement('span')
    dot.className = `dot ${idx === currentStep ? 'active' : ''}`
    dotsContainer.appendChild(dot)
  })

  // Button text
  btnNext.textContent = currentStep === tourSteps.length - 1 ? 'Terminer' : 'Suivant'

  // Cleanup highlights
  document.querySelectorAll('.tour-highlight').forEach((el) => {
    el.classList.remove('tour-highlight')
  })

  if (step.target) {
    const el = document.querySelector(step.target)
    if (el) {
      el.classList.add('tour-highlight')
      positionTooltip(tooltip, el, step.position)
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(11, 43, 27, 0.85)'
  } else {
    // Center tooltip
    tooltip.style.top = '50%'
    tooltip.style.left = '50%'
    tooltip.style.transform = 'translate(-50%, -50%)'

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    overlay.style.background = isDark ? 'rgba(0, 0, 0, 0.92)' : 'rgba(11, 43, 27, 0.92)'
  }
}

function positionTooltip(tooltip, targetEl, position) {
  const rect = targetEl.getBoundingClientRect()
  const gap = 24
  let top, left

  tooltip.style.transform = 'none'

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

  if (left < 10) left = 10
  if (left + tooltip.offsetWidth > window.innerWidth - 10) {
    left = window.innerWidth - tooltip.offsetWidth - 10
  }

  tooltip.style.top = `${top}px`
  tooltip.style.left = `${left}px`
}

function endTour() {
  const overlay = document.getElementById('onboarding-overlay')
  if (overlay) overlay.classList.add('hidden')

  document.querySelectorAll('.tour-highlight').forEach((el) => {
    el.classList.remove('tour-highlight')
  })

  localStorage.setItem('tourCompleted', 'true')
}
