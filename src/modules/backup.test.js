import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./storage.js')
vi.mock('@tauri-apps/plugin-dialog')
vi.mock('@tauri-apps/plugin-fs')

import {
  SCHEMA_VERSION,
  EXPORT_KEYS,
  buildExport,
  validateImport,
  summarizeImport,
} from './backup.js'
import storage from './storage.js'

beforeEach(() => {
  storage._reset()
})

// ─── buildExport ───

describe('buildExport', () => {
  it('produit une enveloppe avec app/schemaVersion/appVersion/exportedAt/data', () => {
    storage.set('theme', 'dark')
    const env = buildExport()

    expect(env.app).toBe('guideme-ramadan')
    expect(env.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof env.appVersion).toBe('string')
    expect(typeof env.exportedAt).toBe('string')
    expect(env.data.theme).toBe('dark')
  })

  it('round-trip : buildExport → validateImport est OK', () => {
    storage.set('practiceLog', { '2026-06-10': { quranPages: 3 } })
    storage.set('journal', { '2026-06-10': 'Alhamdulillah' })
    storage.set('theme', 'light')

    const env = buildExport()
    const result = validateImport(env)

    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data.practiceLog).toEqual({ '2026-06-10': { quranPages: 3 } })
    expect(result.data.journal).toEqual({ '2026-06-10': 'Alhamdulillah' })
    expect(result.data.theme).toBe('light')
  })

  it('exclut les clés null de l’export', () => {
    storage.set('theme', 'dark')
    // journal jamais défini → null
    const env = buildExport()

    expect(env.data).toHaveProperty('theme')
    expect(env.data).not.toHaveProperty('journal')
    expect(env.data).not.toHaveProperty('practiceLog')
  })

  it('n’exporte jamais les clés de cache', () => {
    storage.set('mawaqitCache', { foo: 'bar' })
    storage.set('mawaqitCalendarCache', { foo: 'bar' })
    storage.set('prayerTimesCache', { foo: 'bar' })
    storage.set('lastSeenVersion', '1.9.0')
    storage.set('lastExportDate', '2026-06-10T00:00:00.000Z')
    storage.set('widgetPosition', { x: 10, y: 20 })
    storage.set('theme', 'dark')

    const env = buildExport()

    expect(env.data).not.toHaveProperty('mawaqitCache')
    expect(env.data).not.toHaveProperty('mawaqitCalendarCache')
    expect(env.data).not.toHaveProperty('prayerTimesCache')
    expect(env.data).not.toHaveProperty('lastSeenVersion')
    expect(env.data).not.toHaveProperty('lastExportDate')
    expect(env.data).not.toHaveProperty('widgetPosition')
    expect(env.data).toHaveProperty('theme')
  })

  it('les clés de cache ne figurent pas dans EXPORT_KEYS', () => {
    const forbidden = [
      'mawaqitCache', 'mawaqitCalendarCache', 'prayerTimesCache',
      'lastSeenVersion', 'updater_lastCheck', 'updater_dismissedVersion',
      'updater_notifiedVersion', '__migrated_from_localstorage__',
      'widgetPosition', 'lastExportDate',
    ]
    for (const key of forbidden) {
      expect(EXPORT_KEYS).not.toContain(key)
    }
  })
})

// ─── validateImport ───

describe('validateImport', () => {
  it('rejette un mauvais identifiant d’app', () => {
    const result = validateImport({
      app: 'autre-app',
      schemaVersion: 1,
      data: { theme: 'dark' },
    })

    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejette un schemaVersion plus récent (2)', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 2,
      data: { theme: 'dark' },
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('plus récente'))).toBe(true)
  })

  it('rejette un schemaVersion non entier avec un message « invalide » (pas « plus récente »)', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 'x',
      data: { theme: 'dark' },
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('invalide'))).toBe(true)
    expect(result.errors.some((e) => e.includes('plus récente'))).toBe(false)
  })

  it('rejette un schemaVersion < 1 (0) avec un message « invalide » (pas « plus récente »)', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 0,
      data: { theme: 'dark' },
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('invalide'))).toBe(true)
    expect(result.errors.some((e) => e.includes('plus récente'))).toBe(false)
  })

  it('rejette un fichier non-objet', () => {
    expect(validateImport(null).ok).toBe(false)
    expect(validateImport('texte').ok).toBe(false)
    expect(validateImport(42).ok).toBe(false)
  })

  it('ignore une clé inconnue avec un warning', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { theme: 'dark', cléBidon: 123 },
    })

    expect(result.ok).toBe(true)
    expect(result.data).not.toHaveProperty('cléBidon')
    expect(result.data.theme).toBe('dark')
    expect(result.warnings.some((w) => w.includes('cléBidon'))).toBe(true)
  })

  it('skippe un practiceLog malformé (string) avec un warning', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { practiceLog: 'pas un objet', theme: 'dark' },
    })

    expect(result.data).not.toHaveProperty('practiceLog')
    expect(result.data.theme).toBe('dark')
    expect(result.warnings.some((w) => w.includes('practiceLog'))).toBe(true)
  })

  it('skippe un journal malformé (valeurs non-string) avec un warning', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { journal: { '2026-06-10': { texte: 'oops' } }, theme: 'dark' },
    })

    expect(result.data).not.toHaveProperty('journal')
    expect(result.warnings.some((w) => w.includes('journal'))).toBe(true)
  })

  it('accepte userLat/userLon en chaînes numériques (coords Mawaqit)', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { userLat: '45.75', userLon: '4.85' },
    })

    expect(result.ok).toBe(true)
    expect(result.data.userLat).toBe('45.75')
    expect(result.data.userLon).toBe('4.85')
  })

  it('accepte userLat/userLon en nombres', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { userLat: 45.75, userLon: 4.85 },
    })

    expect(result.ok).toBe(true)
    expect(result.data.userLat).toBe(45.75)
    expect(result.data.userLon).toBe(4.85)
  })

  it('skippe userLat en chaîne vide avec un warning', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { userLat: '', theme: 'dark' },
    })

    expect(result.data).not.toHaveProperty('userLat')
    expect(result.data.theme).toBe('dark')
    expect(result.warnings.some((w) => w.includes('userLat'))).toBe(true)
  })

  it('skippe userLat en chaîne non numérique avec un warning', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { userLat: 'abc', theme: 'dark' },
    })

    expect(result.data).not.toHaveProperty('userLat')
    expect(result.data.theme).toBe('dark')
    expect(result.warnings.some((w) => w.includes('userLat'))).toBe(true)
  })

  it('skippe un theme invalide avec un warning', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { theme: 'turquoise', goals: [] },
    })

    expect(result.data).not.toHaveProperty('theme')
    expect(result.warnings.some((w) => w.includes('theme'))).toBe(true)
  })

  it('ok=false si zéro clé valide', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
      data: { cléBidon: 1, autreBidon: 2 },
    })

    expect(result.ok).toBe(false)
  })

  it('accepte des données vides comme data manquante (ok=false)', () => {
    const result = validateImport({
      app: 'guideme-ramadan',
      schemaVersion: 1,
    })

    expect(result.ok).toBe(false)
  })
})

// ─── summarizeImport ───

describe('summarizeImport', () => {
  it('compte correctement les jours de suivi et entrées de journal', () => {
    const summary = summarizeImport({
      practiceLog: { '2026-06-08': {}, '2026-06-09': {}, '2026-06-10': {} },
      journal: { '2026-06-09': 'a', '2026-06-10': 'b' },
      mosqueName: 'Grande Mosquée de Paris',
    })

    expect(summary.practiceDays).toBe(3)
    expect(summary.journalEntries).toBe(2)
    expect(summary.mosqueName).toBe('Grande Mosquée de Paris')
  })

  it('renvoie 0 et null quand les données sont absentes', () => {
    const summary = summarizeImport({})

    expect(summary.practiceDays).toBe(0)
    expect(summary.journalEntries).toBe(0)
    expect(summary.mosqueName).toBeNull()
  })
})
