/**
 * bug-report.js — Bug Report modal → GitHub Issues
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import storage from './storage.js'

const GITHUB_REPO = 'SofianeBel/myramadan'
const STORAGE_KEY = 'githubToken'

async function createGitHubIssue(token, title, description, includeLogs) {
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
            'Authorization': `token ${token}`,
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
    const tokenSection = document.getElementById('bug-token-section')
    const tokenInput = document.getElementById('bug-github-token')
    const tokenStatus = document.getElementById('bug-token-status')

    if (!bugBtn || !modal) return

    const updateTokenUI = () => {
        const saved = storage.get(STORAGE_KEY)
        if (saved) {
            tokenInput.value = ''
            tokenInput.placeholder = 'Token enregistre (' + saved.slice(-8) + ')'
            tokenStatus.textContent = 'Token configure'
            tokenStatus.style.color = '#4CAF50'
        } else {
            tokenInput.placeholder = 'ghp_xxxx ou github_pat_xxxx'
            tokenStatus.textContent = 'Aucun token configure'
            tokenStatus.style.color = 'var(--text-muted)'
        }
    }

    // Save token on input blur
    tokenInput.addEventListener('change', () => {
        const val = tokenInput.value.trim()
        if (val) {
            storage.set(STORAGE_KEY, val)
            updateTokenUI()
        }
    })

    // Open modal
    bugBtn.addEventListener('click', (e) => {
        e.preventDefault()
        modal.classList.remove('hidden')

        // Reset state
        form.style.display = 'flex'
        successMsg.classList.add('hidden')
        errorMsg.classList.add('hidden')
        form.reset()
        updateTokenUI()
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
        // Save token if user typed one
        const newToken = tokenInput.value.trim()
        if (newToken) storage.set(STORAGE_KEY, newToken)

        const token = storage.get(STORAGE_KEY)
        if (!token) {
            tokenStatus.textContent = 'Token requis pour envoyer'
            tokenStatus.style.color = '#F44336'
            tokenInput.focus()
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
            await createGitHubIssue(token, title, description, includeLogs)
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
