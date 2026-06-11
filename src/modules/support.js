/**
 * support.js — Gestion de la fonctionnalité de soutien (Dons + Publicités)
 * Note: L'onglet Publicités est en mode "Prochainement" — la logique ads est désactivée.
 */

import storage from './storage.js'

class SupportManager {
    constructor() {
        this.btn = document.getElementById('support-btn')
        this.modal = document.getElementById('support-modal')
        this.form = document.getElementById('support-form')
        this.cancelBtn = document.getElementById('support-cancel')

        // Tabs
        this.tabs = this.modal ? this.modal.querySelectorAll('.settings-tab') : []
        this.tabContents = this.modal ? this.modal.querySelectorAll('.support-tab-content') : []
    }

    async init() {
        if (!this.btn || !this.modal || !this.form) {
            console.warn('Support DOM elements not found.')
            return
        }

        // Check if user has already interacted with it to hide the NEW badge
        const hasInteracted = await storage.get('support_interacted')
        if (hasInteracted) {
            const badge = this.btn.querySelector('.badge-new')
            if (badge) badge.remove()
        }

        // Event listeners
        this.btn.addEventListener('click', (e) => {
            e.preventDefault()
            this.openModal()
        })

        this.cancelBtn.addEventListener('click', () => {
            this.closeModal()
        })

        // Tab switching
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab

                this.tabs.forEach(t => t.classList.remove('active'))
                tab.classList.add('active')

                this.tabContents.forEach(content => {
                    const isTarget = content.id === `support-tab-${targetTab}`
                    if (isTarget) {
                        content.classList.remove('hidden')
                    } else {
                        content.classList.add('hidden')
                    }
                })
            })
        })

        // Le formulaire n'a plus de bouton de soumission (rien à enregistrer) :
        // on neutralise un éventuel submit implicite (touche Entrée)
        this.form.addEventListener('submit', (e) => e.preventDefault())

        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal()
            }
        })
    }

    openModal() {
        this.modal.classList.remove('hidden')
        // Ouvrir la modale = interaction : masquer le badge NEW définitivement
        storage.set('support_interacted', true)
        const badge = this.btn.querySelector('.badge-new')
        if (badge) badge.remove()
    }

    closeModal() {
        this.modal.classList.add('hidden')
    }
}

export const supportManager = new SupportManager()

export async function initSupport() {
    await supportManager.init()
}
