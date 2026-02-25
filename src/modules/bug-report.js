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

    const validationError = document.getElementById('bug-validation-error')

    if (!bugBtn || !modal) return

    // Ouverture de la modale
    bugBtn.addEventListener('click', (e) => {
        e.preventDefault()
        modal.classList.remove('hidden')

        // Réinitialisation
        form.style.display = 'flex'
        successMsg.classList.add('hidden')
        errorMsg.classList.add('hidden')
        if (validationError) validationError.classList.add('hidden')
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

    // Limitation du débit (anti-spam)
    let lastSubmitTime = 0
    const SUBMIT_COOLDOWN_MS = 60_000

    // Submit handler
    const handleSubmit = async () => {
        const title = document.getElementById('bug-title').value.trim()
        const description = document.getElementById('bug-description').value.trim()
        const includeLogs = document.getElementById('bug-include-logs').checked
        // fallback to 'bug' if not found
        const reportTypeNode = document.querySelector('input[name="report_type"]:checked')
        const reportType = reportTypeNode ? reportTypeNode.value : 'bug'

        // Validation longueur (affichage inline, formulaire reste visible)
        if (title.length < 5 || title.length > 200) {
            if (validationError) {
                validationError.textContent = 'Le titre doit contenir entre 5 et 200 caractères.'
                validationError.classList.remove('hidden')
            }
            return
        }
        if (description.length < 10 || description.length > 5000) {
            if (validationError) {
                validationError.textContent = 'La description doit contenir entre 10 et 5000 caractères.'
                validationError.classList.remove('hidden')
            }
            return
        }
        if (validationError) validationError.classList.add('hidden')

        // Limitation du débit (anti-spam)
        const now = Date.now()
        if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
            const remaining = Math.ceil((SUBMIT_COOLDOWN_MS - (now - lastSubmitTime)) / 1000)
            errorDetail.textContent = `Veuillez patienter ${remaining} secondes avant de renvoyer un rapport.`
            form.style.display = 'none'
            errorMsg.classList.remove('hidden')
            return
        }

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
                    report_type: reportType
                }
            })
            lastSubmitTime = Date.now()
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
