export function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    // Fallback if elements not found
    if (!sidebar || !toggleBtn) return;

    // Dynamic import to avoid circular dependencies if any, though regular import is fine here.
    import('./storage.js').then(({ default: storage }) => {
        // Load preference
        const isMinimized = storage.get('sidebar_minimized') === true;

        if (isMinimized) {
            sidebar.classList.add('minimized');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('minimized');
            storage.set('sidebar_minimized', sidebar.classList.contains('minimized'));
        });
    });
}
