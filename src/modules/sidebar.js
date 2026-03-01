import { isMobile } from './platform.js'

let drawerInitialized = false

export function initSidebar() {
    const sidebar = document.querySelector('.sidebar')
    const toggleBtn = document.getElementById('sidebar-toggle')
    const hamburgerBtn = document.getElementById('hamburger-btn')
    const backdrop = document.getElementById('sidebar-backdrop')

    if (!sidebar) return

    if (isMobile) {
        if (!drawerInitialized) {
            initMobileDrawer(sidebar, hamburgerBtn, backdrop)
            drawerInitialized = true
        }
    } else {
        initDesktopSidebar(sidebar, toggleBtn)
    }
}

function initDesktopSidebar(sidebar, toggleBtn) {
    if (!toggleBtn) return
    import('./storage.js').then(({ default: storage }) => {
        const isMinimized = storage.get('sidebar_minimized') === true
        if (isMinimized) sidebar.classList.add('minimized')

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('minimized')
            storage.set('sidebar_minimized', sidebar.classList.contains('minimized'))
        })
    })
}

function initMobileDrawer(sidebar, hamburgerBtn, backdrop) {
    function openDrawer() {
        sidebar.classList.add('drawer-open')
        if (backdrop) backdrop.classList.add('visible')
    }

    function closeDrawer() {
        sidebar.classList.remove('drawer-open')
        if (backdrop) backdrop.classList.remove('visible')
    }

    // Bouton hamburger → ouvrir
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', openDrawer)
    }

    // Tap sur le backdrop → fermer
    if (backdrop) {
        backdrop.addEventListener('click', closeDrawer)
    }

    // Fermer le drawer quand un élément du menu est tapé
    sidebar.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', closeDrawer)
    })

    // Geste swipe : bord gauche → ouvrir, glisser à gauche → fermer
    let touchStartX = 0
    let touchStartY = 0
    const EDGE_THRESHOLD = 30
    const SWIPE_MIN = 60

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
    }, { passive: true })

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX
        const touchEndY = e.changedTouches[0].clientY
        const deltaX = touchEndX - touchStartX
        const deltaY = Math.abs(touchEndY - touchStartY)

        // Ignorer les swipes verticaux
        if (deltaY > Math.abs(deltaX)) return

        const isDrawerOpen = sidebar.classList.contains('drawer-open')

        // Swipe droite depuis le bord gauche → ouvrir
        if (!isDrawerOpen && touchStartX < EDGE_THRESHOLD && deltaX > SWIPE_MIN) {
            openDrawer()
        }

        // Swipe gauche → fermer
        if (isDrawerOpen && deltaX < -SWIPE_MIN) {
            closeDrawer()
        }
    }, { passive: true })
}
