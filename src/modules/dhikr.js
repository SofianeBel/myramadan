/**
 * dhikr.js — Dhikr / Tasbih counter
 *
 * Card on the dashboard with presets (post-prayer cycle, individual dhikrs),
 * a big + button, keyboard shortcut (Space), flash animation on target
 * completion, and auto-advance to next dhikr in cycle.
 */

import storage from './storage.js'
import { addDhikrCount } from './practice-tracker.js'

const DHIKR_STATE_KEY = 'dhikrState'

const PRESETS = [
  {
    id: 'post-prayer',
    name: 'Cycle post-priere',
    steps: [
      { arabic: '\u0633\u064F\u0628\u0652\u062D\u064E\u0627\u0646\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u0650', transliteration: 'SubhanAllah', target: 33 },
      { arabic: '\u0627\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F \u0644\u0650\u0644\u0651\u064E\u0647\u0650', transliteration: 'Alhamdulillah', target: 33 },
      { arabic: '\u0627\u0644\u0644\u0651\u064E\u0647\u064F \u0623\u064E\u0643\u0652\u0628\u064E\u0631\u064F', transliteration: 'Allahu Akbar', target: 34 },
    ]
  },
  {
    id: 'subhanallah',
    name: 'SubhanAllah',
    steps: [{ arabic: '\u0633\u064F\u0628\u0652\u062D\u064E\u0627\u0646\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u0650', transliteration: 'SubhanAllah', target: 100 }]
  },
  {
    id: 'astaghfirullah',
    name: 'Astaghfirullah',
    steps: [{ arabic: '\u0623\u064E\u0633\u0652\u062A\u064E\u063A\u0652\u0641\u0650\u0631\u064F \u0627\u0644\u0644\u0651\u064E\u0647\u064E', transliteration: 'Astaghfirullah', target: 100 }]
  },
  {
    id: 'la-ilaha',
    name: 'La ilaha illa Allah',
    steps: [{ arabic: '\u0644\u064E\u0627 \u0625\u0650\u0644\u064E\u0670\u0647\u064E \u0625\u0650\u0644\u0651\u064E\u0627 \u0627\u0644\u0644\u0651\u064E\u0647\u064F', transliteration: 'La ilaha illa Allah', target: 100 }]
  },
  {
    id: 'salawat',
    name: 'Salawat sur le Prophete \uFDFA',
    steps: [{ arabic: '\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0635\u064E\u0644\u0651\u0650 \u0639\u064E\u0644\u064E\u0649 \u0645\u064F\u062D\u064E\u0645\u0651\u064E\u062F\u064D', transliteration: 'Allahumma salli ala Muhammad', target: 100 }]
  }
]

let currentPresetId = 'post-prayer'
let currentStepIndex = 0
let currentCount = 0

function getState() {
  return storage.get(DHIKR_STATE_KEY) || { presetId: 'post-prayer', stepIndex: 0, count: 0 }
}

function saveState() {
  storage.set(DHIKR_STATE_KEY, { presetId: currentPresetId, stepIndex: currentStepIndex, count: currentCount })
}

function getCurrentPreset() {
  return PRESETS.find(p => p.id === currentPresetId) || PRESETS[0]
}

function getCurrentStep() {
  const preset = getCurrentPreset()
  return preset.steps[currentStepIndex] || preset.steps[0]
}

function increment() {
  currentCount++
  const step = getCurrentStep()
  const preset = getCurrentPreset()

  if (currentCount >= step.target) {
    // Step complete — flash animation
    flashComplete()
    addDhikrCount(step.target)

    if (currentStepIndex < preset.steps.length - 1) {
      // Auto-advance to next step
      currentStepIndex++
      currentCount = 0
    } else {
      // Full cycle complete
      cycleComplete()
      currentStepIndex = 0
      currentCount = 0
    }
  }

  saveState()
  renderDhikr()
}

function reset() {
  currentCount = 0
  currentStepIndex = 0
  saveState()
  renderDhikr()
}

function selectPreset(presetId) {
  currentPresetId = presetId
  currentStepIndex = 0
  currentCount = 0
  saveState()
  renderDhikr()
}

function flashComplete() {
  const card = document.getElementById('dhikr-card')
  if (!card) return
  card.classList.add('dhikr-flash')
  setTimeout(() => card.classList.remove('dhikr-flash'), 600)
}

function cycleComplete() {
  const card = document.getElementById('dhikr-card')
  if (!card) return
  card.classList.add('dhikr-cycle-complete')
  setTimeout(() => card.classList.remove('dhikr-cycle-complete'), 1200)
}

// ─── Rendering ───

function renderDhikr() {
  const step = getCurrentStep()
  const preset = getCurrentPreset()

  const arabicEl = document.getElementById('dhikr-arabic')
  const translitEl = document.getElementById('dhikr-translit')
  const countEl = document.getElementById('dhikr-count')
  const targetEl = document.getElementById('dhikr-target')
  const progressEl = document.getElementById('dhikr-progress-fill')
  const stepIndicator = document.getElementById('dhikr-step-indicator')

  if (arabicEl) arabicEl.textContent = step.arabic
  if (translitEl) translitEl.textContent = step.transliteration
  if (countEl) countEl.textContent = currentCount
  if (targetEl) targetEl.textContent = `/ ${step.target}`
  if (progressEl) {
    const pct = Math.min(100, (currentCount / step.target) * 100)
    progressEl.style.width = `${pct}%`
  }

  // Step indicator for multi-step presets
  if (stepIndicator) {
    if (preset.steps.length > 1) {
      stepIndicator.textContent = `${currentStepIndex + 1}/${preset.steps.length}`
      stepIndicator.classList.remove('hidden')
    } else {
      stepIndicator.classList.add('hidden')
    }
  }
}

function renderPresetOptions(select) {
  select.replaceChildren()
  PRESETS.forEach(p => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.name
    opt.selected = p.id === currentPresetId
    select.appendChild(opt)
  })
}

export function initDhikr() {
  const state = getState()
  currentPresetId = state.presetId
  currentStepIndex = state.stepIndex
  currentCount = state.count

  const card = document.getElementById('dhikr-card')
  const incrementBtn = document.getElementById('dhikr-increment')
  const resetBtn = document.getElementById('dhikr-reset')
  const presetSelect = document.getElementById('dhikr-preset-select')

  if (presetSelect) {
    renderPresetOptions(presetSelect)
    presetSelect.addEventListener('change', (e) => selectPreset(e.target.value))
  }

  if (incrementBtn) {
    incrementBtn.addEventListener('click', () => increment())
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => reset())
  }

  // Space key shortcut when card is focused
  if (card) {
    card.setAttribute('tabindex', '0')
    card.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement === card) {
        e.preventDefault()
        increment()
      }
    })
  }

  renderDhikr()
}
