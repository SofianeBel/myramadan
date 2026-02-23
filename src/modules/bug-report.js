/**
 * bug-report.js — Bug Report modal → GitHub Issues
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN
const GITHUB_REPO = 'SofianeBel/myramadan'

async function createGitHubIssue(title, description, includeLogs) {
    const systemInfo = [
        `- **App**: GuideME Ramadan v1.0.0`,
        `- **OS**: ${navigator.userAgent}`,
        `- **Date**: ${new Date().toLocaleString('fr-FR')}`,
    ].join('\n')

    const body = [
        `## Description`,
        description,
        ``,
        `## Informations systeme`,
        systemInfo,
        includeLogs ? `\n> Logs de l'application joints par l'utilisateur` : '',
    ].join('\n')

    const response = await tauriFetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GuideME-Ramadan',
        },
        body: JSON.stringify({
            title: `[Bug] ${title}`,
            body,
            labels: ['bug'],
        }),
    })

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || `Erreur HTTP ${response.status}`)
    }

    return await response.json()
}

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
        if (!GITHUB_TOKEN) {
            console.error('[BugReport] VITE_GITHUB_TOKEN non configure')
            form.style.display = 'none'
            errorDetail.textContent = 'Le service de rapport de bug n\'est pas configure.'
            errorMsg.classList.remove('hidden')
            return
        }

        const title = document.getElementById('bug-title').value
        const description = document.getElementById('bug-description').value
        const includeLogs = document.getElementById('bug-include-logs').checked

        // Loading state
        submitBtn.disabled = true
        submitBtn.textContent = 'Envoi en cours...'
        errorMsg.classList.add('hidden')

        try {
            await createGitHubIssue(title, description, includeLogs)
            form.style.display = 'none'
            successMsg.classList.remove('hidden')
        } catch (err) {
            console.error('[BugReport] Erreur:', err)
            form.style.display = 'none'
            errorDetail.textContent = err.message || 'Impossible d\'envoyer le rapport. Verifiez votre connexion internet.'
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
