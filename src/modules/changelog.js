/**
 * changelog.js — Modale "Quoi de neuf" avec badge NEW dans la sidebar
 * Pattern identique à support.js : storage get/set pour masquer le badge après interaction.
 */

import storage from './storage.js'

const APP_VERSION = '1.1.1'

const CHANGELOG_ENTRIES = [
  {
    version: '1.1.1',
    date: '24 février 2026',
    changes: [
      { type: 'fix', text: 'Correction du pipeline de release automatique' },
      { type: 'fix', text: 'Couleurs CSS harmonisées (variables custom)' },
      { type: 'fix', text: 'Commentaires traduits en français' },
    ],
  },
  {
    version: '1.1.0',
    date: '24 février 2026',
    changes: [
      { type: 'feature', text: 'Modale "Quoi de neuf" pour suivre les nouveautés' },
      { type: 'feature', text: 'Soutenir GuideME — dons via PayPal, Ko-fi, Buy Me a Coffee' },
      { type: 'feature', text: 'Signaler un bug — formulaire intégré (GitHub Issues)' },
      { type: 'feature', text: 'Calendrier mensuel des horaires de prière' },
      { type: 'feature', text: 'Navigation par date (±30 jours)' },
      { type: 'feature', text: 'Notifications de prière avec choix d\'adhan' },
      { type: 'feature', text: 'Toggles individuels par prière' },
      { type: 'feature', text: 'Tutoriel interactif au premier lancement' },
      { type: 'feature', text: 'Titlebar custom avec sakura animés' },
      { type: 'feature', text: 'Lancement au démarrage (autostart)' },
      { type: 'feature', text: 'System tray — fermer = minimiser' },
      { type: 'feature', text: 'CI/CD — release automatique Windows' },
      { type: 'improvement', text: 'Méthode UOIF corrigée (angles 15° custom)' },
      { type: 'improvement', text: 'Responsive settings pour petits écrans' },
      { type: 'improvement', text: 'Glassmorphism cohérent sur toutes les modales' },
      { type: 'fix', text: 'Barre de progression jeûne masquée hors heures' },
      { type: 'fix', text: 'Permissions fenêtre pour titlebar custom' },
      { type: 'fix', text: 'Reset notifications par prière à l\'activation' },
    ],
  },
]

const TYPE_CONFIG = {
  feature: { icon: 'fa-solid fa-plus', label: 'Nouveau' },
  improvement: { icon: 'fa-solid fa-arrow-up', label: 'Amélioration' },
  fix: { icon: 'fa-solid fa-wrench', label: 'Correction' },
}

function buildChangelogList(container) {
  CHANGELOG_ENTRIES.forEach(entry => {
    // En-tête de version
    const header = document.createElement('div')
    header.className = 'changelog-version-header'

    const badgeSpan = document.createElement('span')
    badgeSpan.className = 'changelog-version-badge'
    badgeSpan.textContent = `v${entry.version}`
    header.appendChild(badgeSpan)

    const dateSpan = document.createElement('span')
    dateSpan.className = 'changelog-version-date'
    dateSpan.textContent = entry.date
    header.appendChild(dateSpan)

    container.appendChild(header)

    // Entrées de changement
    entry.changes.forEach(change => {
      const cfg = TYPE_CONFIG[change.type]
      const row = document.createElement('div')
      row.className = `changelog-entry changelog-type-${change.type}`

      const icon = document.createElement('i')
      icon.className = `${cfg.icon} changelog-type-icon`
      row.appendChild(icon)

      const text = document.createElement('span')
      text.textContent = change.text
      row.appendChild(text)

      container.appendChild(row)
    })
  })
}

export async function initChangelog() {
  const btn = document.getElementById('changelog-btn')
  const modal = document.getElementById('changelog-modal')
  const closeBtn = document.getElementById('changelog-close')
  const badge = document.getElementById('changelog-badge')
  const listEl = document.getElementById('changelog-list')
  const versionEl = document.getElementById('changelog-version')

  if (!btn || !modal) return

  // Afficher la version dans le footer
  if (versionEl) versionEl.textContent = `v${APP_VERSION}`

  // Rendre la liste des changements via DOM API
  if (listEl) buildChangelogList(listEl)

  // Vérifier si l'utilisateur a déjà vu cette version
  const lastSeen = await storage.get('lastSeenVersion')
  if (lastSeen === APP_VERSION && badge) {
    badge.style.display = 'none'
  }

  // Ouvrir la modale
  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    modal.classList.remove('hidden')

    // Marquer comme vu
    await storage.set('lastSeenVersion', APP_VERSION)
    if (badge) badge.style.display = 'none'
  })

  // Fermer
  const closeModal = () => modal.classList.add('hidden')

  if (closeBtn) closeBtn.addEventListener('click', closeModal)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })
}
