import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')

import {
  computeKhatmProgress,
  defaultTargetDate,
  setHijriContext,
  rollupOldPages,
} from './khatm.js'
import storage from './storage.js'

beforeEach(() => {
  storage._reset()
})

// ─── Helpers ───

// Construit une clé de date locale décalée de `offset` jours par rapport à `base`
function shiftKey(baseKey, offsetDays) {
  const [y, m, d] = baseKey.split('-').map(Number)
  const date = new Date(y, m - 1, d + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeEntry(pages) {
  return { prayers: [false, false, false, false, false], fasting: false, quranPages: pages, dhikrCount: 0 }
}

// Plan de base réutilisable dans les tests de progression
function basePlan(overrides = {}) {
  return {
    active: true,
    startDate: '2026-03-01',
    targetDate: '2026-03-30',
    totalPages: 604,
    startOffset: 0,
    rolledUpPages: 0,
    rolledUpThrough: null,
    completedAt: null,
    ...overrides,
  }
}

// ─── computeKhatmProgress : plan neuf ───

describe('computeKhatmProgress — plan neuf', () => {
  it('renvoie 0 pages lues quand le log est vide', () => {
    const plan = basePlan()
    const result = computeKhatmProgress(plan, {}, '2026-03-01')
    expect(result.pagesRead).toBe(0)
    expect(result.pagesToday).toBe(0)
    expect(result.remaining).toBe(604)
    expect(result.percent).toBe(0)
    expect(result.done).toBe(false)
  })

  it('additionne les pages du startDate à aujourd\'hui inclus', () => {
    const log = {
      '2026-03-01': makeEntry(10),
      '2026-03-02': makeEntry(20),
      '2026-03-03': makeEntry(5),
    }
    const result = computeKhatmProgress(basePlan(), log, '2026-03-03')
    expect(result.pagesRead).toBe(35)
    expect(result.pagesToday).toBe(5)
    expect(result.remaining).toBe(604 - 35)
  })

  it('ignore les entrées antérieures au startDate', () => {
    const log = {
      '2026-02-28': makeEntry(100),
      '2026-03-01': makeEntry(10),
    }
    const result = computeKhatmProgress(basePlan(), log, '2026-03-01')
    expect(result.pagesRead).toBe(10)
  })

  it('ignore les entrées postérieures à aujourd\'hui', () => {
    const log = {
      '2026-03-01': makeEntry(10),
      '2026-03-05': makeEntry(50),
    }
    const result = computeKhatmProgress(basePlan(), log, '2026-03-01')
    expect(result.pagesRead).toBe(10)
  })

  it('traite quranPages manquant comme 0', () => {
    const log = {
      '2026-03-01': { prayers: [], fasting: false, dhikrCount: 0 },
      '2026-03-02': makeEntry(7),
    }
    const result = computeKhatmProgress(basePlan(), log, '2026-03-02')
    expect(result.pagesRead).toBe(7)
  })
})

// ─── startOffset ───

describe('computeKhatmProgress — startOffset', () => {
  it('compte les pages déjà lues avant le plan', () => {
    const plan = basePlan({ startOffset: 100 })
    const log = { '2026-03-01': makeEntry(10) }
    const result = computeKhatmProgress(plan, log, '2026-03-01')
    expect(result.pagesRead).toBe(110)
  })

  it('le startOffset ne compte pas comme pages lues aujourd\'hui', () => {
    const plan = basePlan({ startOffset: 100 })
    const log = { '2026-03-01': makeEntry(10) }
    const result = computeKhatmProgress(plan, log, '2026-03-01')
    expect(result.pagesToday).toBe(10)
  })
})

// ─── rolledUpPages + fenêtre live ───

describe('computeKhatmProgress — rolledUpPages', () => {
  it('ajoute rolledUpPages et ignore les jours déjà absorbés', () => {
    const plan = basePlan({ rolledUpPages: 200, rolledUpThrough: '2026-03-10' })
    const log = {
      '2026-03-05': makeEntry(999), // déjà absorbé (≤ rolledUpThrough) → ignoré
      '2026-03-11': makeEntry(15),
      '2026-03-12': makeEntry(5),
    }
    const result = computeKhatmProgress(plan, log, '2026-03-12')
    expect(result.pagesRead).toBe(200 + 20)
  })
})

// ─── dailyTarget : remainder en début de journée ───

describe('computeKhatmProgress — dailyTarget', () => {
  it('utilise le reste en début de journée (today exclu du remainder)', () => {
    // 30 jours de plan, 0 lu avant aujourd'hui, 10 lus aujourd'hui
    const plan = basePlan({ startDate: '2026-03-01', targetDate: '2026-03-30' })
    const log = { '2026-03-01': makeEntry(10) }
    const result = computeKhatmProgress(plan, log, '2026-03-01')
    // daysRemaining = 30, remainder début de journée = 604 - (10 - 10) = 604
    // dailyTarget = ceil(604 / 30) = 21
    expect(result.daysRemaining).toBe(30)
    expect(result.dailyTarget).toBe(21)
  })

  it('ne rétrécit pas l\'objectif du jour quand on saisit des pages', () => {
    const plan = basePlan({ startDate: '2026-03-01', targetDate: '2026-03-30' })
    const before = computeKhatmProgress(plan, { '2026-03-01': makeEntry(0) }, '2026-03-01')
    const after = computeKhatmProgress(plan, { '2026-03-01': makeEntry(15) }, '2026-03-01')
    expect(after.dailyTarget).toBe(before.dailyTarget)
  })

  it('daysRemaining inclut aujourd\'hui (minimum 1)', () => {
    const plan = basePlan({ targetDate: '2026-03-10' })
    const result = computeKhatmProgress(plan, {}, '2026-03-10')
    expect(result.daysRemaining).toBe(1)
  })

  it('rattrapage : cible passée → daysRemaining ramené à 1', () => {
    const plan = basePlan({ targetDate: '2026-03-10' })
    const log = { '2026-03-01': makeEntry(100) }
    const result = computeKhatmProgress(plan, log, '2026-03-15')
    expect(result.daysRemaining).toBe(1)
    // tout le reste à lire aujourd'hui
    expect(result.dailyTarget).toBe(604 - 100)
  })
})

// ─── catch-up après des jours manqués ───

describe('computeKhatmProgress — rattrapage', () => {
  it('augmente l\'objectif du jour après des jours sans lecture', () => {
    const plan = basePlan({ startDate: '2026-03-01', targetDate: '2026-03-30' })
    // Rien lu pendant 9 jours, on est le 10
    const result = computeKhatmProgress(plan, {}, '2026-03-10')
    // daysRemaining = 21 (du 10 au 30 inclus), remainder = 604
    expect(result.daysRemaining).toBe(21)
    expect(result.dailyTarget).toBe(Math.ceil(604 / 21))
  })
})

// ─── juz ───

describe('computeKhatmProgress — juz', () => {
  it('0 pages → Juz\' 1', () => {
    const result = computeKhatmProgress(basePlan(), {}, '2026-03-01')
    expect(result.juz).toBe(1)
  })

  it('604 pages → Juz\' 30', () => {
    const plan = basePlan({ startOffset: 604 })
    const result = computeKhatmProgress(plan, {}, '2026-03-01')
    expect(result.juz).toBe(30)
  })

  it('au-delà de 604 reste plafonné à 30', () => {
    const plan = basePlan({ startOffset: 700 })
    const result = computeKhatmProgress(plan, {}, '2026-03-01')
    expect(result.juz).toBe(30)
  })

  it('à mi-chemin (302 pages) → Juz\' 15', () => {
    const plan = basePlan({ startOffset: 302 })
    const result = computeKhatmProgress(plan, {}, '2026-03-01')
    // floor(302 / (604/30)) + 1 = floor(15) + 1 = 16 ... vérifions la borne exacte
    expect(result.juz).toBe(16)
  })
})

// ─── pace ───

describe('computeKhatmProgress — pace', () => {
  it('en avance quand on lit plus vite que prévu', () => {
    const plan = basePlan({ startDate: '2026-03-01', targetDate: '2026-03-30' })
    // Au jour 1, on a déjà lu 100 pages — bien au-dessus de l'attendu
    const result = computeKhatmProgress(plan, { '2026-03-01': makeEntry(100) }, '2026-03-01')
    expect(result.pace).toBe('ahead')
  })

  it('en retard quand le déficit dépasse l\'objectif du jour', () => {
    const plan = basePlan({ startDate: '2026-03-01', targetDate: '2026-03-30' })
    // Au jour 20, rien lu → gros déficit
    const result = computeKhatmProgress(plan, {}, '2026-03-20')
    expect(result.pace).toBe('behind')
  })
})

// ─── completion ───

describe('computeKhatmProgress — completion', () => {
  it('done=true quand pagesRead atteint totalPages', () => {
    const plan = basePlan({ startOffset: 604 })
    const result = computeKhatmProgress(plan, {}, '2026-03-01')
    expect(result.done).toBe(true)
    expect(result.percent).toBe(100)
    expect(result.remaining).toBe(0)
  })

  it('percent plafonné à 100 et remaining jamais négatif', () => {
    const plan = basePlan({ startOffset: 700 })
    const result = computeKhatmProgress(plan, {}, '2026-03-01')
    expect(result.percent).toBe(100)
    expect(result.remaining).toBe(0)
  })
})

// ─── rollupOldPages ───

describe('rollupOldPages', () => {
  it('absorbe les entrées plus vieilles que safeDays', () => {
    const today = '2026-06-10'
    const plan = basePlan({ startDate: '2026-01-01', rolledUpPages: 0, rolledUpThrough: null })
    const log = {
      [shiftKey(today, -100)]: makeEntry(30), // hors fenêtre → absorbé
      [shiftKey(today, -90)]: makeEntry(20), // hors fenêtre → absorbé
      [shiftKey(today, -10)]: makeEntry(5), // dans fenêtre → conservé
    }
    const { plan: updated, changed } = rollupOldPages(plan, log, today, 60)
    expect(changed).toBe(true)
    expect(updated.rolledUpPages).toBe(50)
    expect(updated.rolledUpThrough).toBe(shiftKey(today, -61))
  })

  it('gère les jours manquants comme 0 (rollup avec trous)', () => {
    const today = '2026-06-10'
    const plan = basePlan({ startDate: '2026-01-01' })
    const log = {
      [shiftKey(today, -100)]: makeEntry(30),
      // trou : pas d'entrée à -95
      [shiftKey(today, -80)]: makeEntry(10),
    }
    const { plan: updated } = rollupOldPages(plan, log, today, 60)
    expect(updated.rolledUpPages).toBe(40)
  })

  it('est idempotent (double rollup ne double pas les pages)', () => {
    const today = '2026-06-10'
    const plan = basePlan({ startDate: '2026-01-01' })
    const log = {
      [shiftKey(today, -100)]: makeEntry(30),
      [shiftKey(today, -90)]: makeEntry(20),
    }
    const first = rollupOldPages(plan, log, today, 60)
    expect(first.changed).toBe(true)
    const second = rollupOldPages(first.plan, log, today, 60)
    expect(second.changed).toBe(false)
    expect(second.plan.rolledUpPages).toBe(50)
  })

  it('ne touche jamais la fenêtre live de 60 jours', () => {
    const today = '2026-06-10'
    const plan = basePlan({ startDate: '2026-01-01' })
    const log = {
      [shiftKey(today, -59)]: makeEntry(7), // dans la fenêtre
      [shiftKey(today, -30)]: makeEntry(8), // dans la fenêtre
      [shiftKey(today, 0)]: makeEntry(3), // aujourd'hui
    }
    const { plan: updated, changed } = rollupOldPages(plan, log, today, 60)
    expect(changed).toBe(false)
    expect(updated.rolledUpPages).toBe(0)
    expect(updated.rolledUpThrough).toBeNull()
  })

  it('progression inchangée avant/après rollup (rollup transparent)', () => {
    const today = '2026-06-10'
    const plan = basePlan({ startDate: '2026-01-01', targetDate: '2026-07-01', totalPages: 604 })
    const log = {
      [shiftKey(today, -100)]: makeEntry(30),
      [shiftKey(today, -90)]: makeEntry(20),
      [shiftKey(today, -10)]: makeEntry(5),
      [shiftKey(today, 0)]: makeEntry(3),
    }
    const before = computeKhatmProgress(plan, log, today)
    const { plan: rolled } = rollupOldPages(plan, log, today, 60)
    const after = computeKhatmProgress(rolled, log, today)
    expect(after.pagesRead).toBe(before.pagesRead)
  })

  it('ne fait rien si le plan est inactif', () => {
    const today = '2026-06-10'
    const plan = basePlan({ active: false, startDate: '2026-01-01' })
    const log = { [shiftKey(today, -100)]: makeEntry(30) }
    const { changed } = rollupOldPages(plan, log, today, 60)
    expect(changed).toBe(false)
  })
})

// ─── defaultTargetDate ───

describe('defaultTargetDate', () => {
  it('hors Ramadan : +30 jours', () => {
    setHijriContext(null)
    const result = defaultTargetDate(null, '2026-06-10')
    expect(result).toBe('2026-07-10')
  })

  it('en Ramadan : +(30 − jour) jours pour finir avec le mois', () => {
    // Jour 10 du Ramadan → +20 jours
    const hijri = { day: '10', month: { number: 9 } }
    const result = defaultTargetDate(hijri, '2026-03-01')
    const [y, m, d] = '2026-03-01'.split('-').map(Number)
    const expected = new Date(y, m - 1, d + 20)
    const expectedKey = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`
    expect(result).toBe(expectedKey)
  })

  it('jour 1 du Ramadan → +29 jours (khatm sur tout le mois)', () => {
    const hijri = { day: 1, month: 9 }
    const result = defaultTargetDate(hijri, '2026-03-01')
    expect(result).toBe('2026-03-30')
  })

  it('au moins +1 jour même le dernier jour du Ramadan', () => {
    const hijri = { day: 30, month: 9 }
    const result = defaultTargetDate(hijri, '2026-03-30')
    // +(30 − 30) = 0 → clampé à 1
    expect(result).toBe('2026-03-31')
  })
})
