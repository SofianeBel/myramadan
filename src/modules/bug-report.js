/**
 * bug-report.js — Frontend logic for the Bug Report modal
 */

export function initBugReport() {
    const bugBtn = document.getElementById('bug-report-btn');
    const modal = document.getElementById('bug-report-modal');
    const cancelBtn = document.getElementById('bug-cancel');
    const form = document.getElementById('bug-report-form');
    const successMsg = document.getElementById('bug-success-msg');
    const closeSuccessBtn = document.getElementById('bug-close-success');

    if (!bugBtn || !modal) return;

    // Open modal
    bugBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Remove active-view logic simply opens the modal overlay
        modal.classList.remove('hidden');

        // Reset state
        form.style.display = 'flex';
        successMsg.classList.add('hidden');
        form.reset();
    });

    // Close modal functions
    const closeModal = () => {
        modal.classList.add('hidden');
    };

    cancelBtn.addEventListener('click', closeModal);
    closeSuccessBtn.addEventListener('click', closeModal);

    // Close on clicking outside the tooltip
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Handle form submit (frontend only simulation)
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Getting values just to show it's there, but no backend call
        const title = document.getElementById('bug-title').value;
        const description = document.getElementById('bug-description').value;
        const includeLogs = document.getElementById('bug-include-logs').checked;

        console.log('[BugReport] Submitting bug:', { title, description, includeLogs });

        // Hide form and show success message
        form.style.display = 'none';
        successMsg.classList.remove('hidden');
    });
}
