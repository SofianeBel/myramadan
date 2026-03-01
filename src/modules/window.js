import { getCurrentWindow } from '@tauri-apps/api/window'
import { isMobile } from './platform.js'

export function initWindowControls() {
    if (isMobile) return // No window controls on mobile

    let appWindow
    try {
        appWindow = getCurrentWindow()
    } catch (e) {
        console.warn('Tauri window API not available (browser context?)')
        return
    }

    const minBtn = document.getElementById('titlebar-minimize')
    const maxBtn = document.getElementById('titlebar-maximize')
    const closeBtn = document.getElementById('titlebar-close')

    if (minBtn) {
        minBtn.addEventListener('click', () => appWindow.minimize())
    }
    if (maxBtn) {
        maxBtn.addEventListener('click', () => appWindow.toggleMaximize())
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => appWindow.close())
    }
}
