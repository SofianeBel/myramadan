/**
 * bug-report.js — Bug Report modal → GitHub Issues (via Rust command)
 */

import { invoke } from '@tauri-apps/api/core'

export function initBugReport() {
    const bugBtn = document.getElementById('bug-report-btn')
    const modal = document.getElementById('bug-report-modal')
    const cancelBtn = document.getElementById('bug-cancel')
    const form = document.getElementById('bug-report-form')
    const submitBtn = document.getElementById('bug-submit')
    const successMsg = document.getElementById('bug-success-msg')
    const closeSuccessBtn = document.getElementById('bug-close-success')
    const errorMsg = document.getElementById('bug-error-msg')
    const errorDetail = document.getElementById('bug-error-detail')
    const retryBtn = document.getElementById('bug-retry')
    const closeErrorBtn = document.getElementById('bug-close-error')

    if (!bugBtn || !modal) return

    // Open modal
    bugBtn.addEventListener('click', (e) => {
        e.preventDefault()
        modal.classList.remove('hidden')

        // Reset state
        form.style.display = 'flex'
        successMsg.classList.add('hidden')
        errorMsg.classList.add('hidden')
        form.reset()
    })

    // Close modal
    const closeModal = () => {
        modal.classList.add('hidden')
    }

    cancelBtn.addEventListener('click', closeModal)
    closeSuccessBtn.addEventListener('click', closeModal)
    closeErrorBtn.addEventListener('click', closeModal)

    // Close on clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal()
    })

    // Submit handler
    const handleSubmit = async () => {
        const title = document.getElementById('bug-title').value
        const description = document.getElementById('bug-description').value
        const includeLogs = document.getElementById('bug-include-logs').checked

        // Loading state
        submitBtn.disabled = true
        submitBtn.textContent = 'Envoi en cours...'
        errorMsg.classList.add('hidden')

        try {
            await invoke('create_bug_report', {
                input: {
                    title,
                    description,
                    include_logs: includeLogs,
                    date: new Date().toLocaleString('fr-FR'),
                }
            })
            form.style.display = 'none'
            successMsg.classList.remove('hidden')
        } catch (err) {
            console.error('[BugReport] Erreur:', err)
            form.style.display = 'none'
            errorDetail.textContent = err || 'Impossible d\'envoyer le rapport. Vérifiez votre connexion internet.'
            errorMsg.classList.remove('hidden')
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = 'Envoyer le rapport'
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault()
        handleSubmit()
    })

    // Retry button
    retryBtn.addEventListener('click', () => {
        errorMsg.classList.add('hidden')
        form.style.display = 'flex'
    })
}
