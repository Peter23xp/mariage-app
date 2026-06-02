/**
 * utils.js
 * Helpers globaux pour l'application Mariage.
 * Expose l'objet window.utils.
 */

(function() {
    // === Composant Toast CSS (Injecté dynamiquement) ===
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
        #toast-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .toast-msg {
            min-width: 250px;
            padding: 15px 20px;
            border-radius: 8px;
            color: #fff;
            font-family: var(--font-body, 'Inter', sans-serif);
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            opacity: 0;
            transform: translateY(20px);
            animation: toast-in 0.3s forwards;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .toast-msg.success { background-color: #2ecc71; color: #000; }
        .toast-msg.error { background-color: #e74c3c; }
        .toast-msg.info { background-color: #c9a84c; color: #000; }
        .toast-msg.fade-out {
            animation: toast-out 0.3s forwards;
        }
        @keyframes toast-in {
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toast-out {
            to { opacity: 0; transform: translateY(20px); }
        }
    `;
    document.head.appendChild(toastStyle);

    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(toastContainer);
    });

    window.utils = {
        /**
         * Affiche un message temporaire (Toast)
         * @param {string} msg - Le message à afficher
         * @param {string} type - 'success', 'error', 'info'
         */
        showToast(msg, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast-msg ${type}`;
            toast.textContent = msg;
            
            // S'assurer que le container existe
            const container = document.getElementById('toast-container');
            if (container) {
                container.appendChild(toast);
                
                setTimeout(() => {
                    toast.classList.add('fade-out');
                    toast.addEventListener('animationend', () => toast.remove());
                }, 3000);
            } else {
                console.warn("Toast:", msg);
            }
        },

        /**
         * Protège contre les injections XSS
         */
        escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        /**
         * Formate une date ISO en "JJ/MM/AAAA à HH:MM"
         */
        formatDate(isoString) {
            if (!isoString) return 'Jamais';
            const date = new Date(isoString);
            if (isNaN(date)) return isoString;
            return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
        },

        /**
         * Formate une date ISO en "HH:MM:SS"
         */
        formatTime(isoString) {
            if (!isoString) return '--:--:--';
            const date = new Date(isoString);
            if (isNaN(date)) return isoString;
            return date.toLocaleTimeString('fr-FR');
        },

        /**
         * Debounce function pour la recherche live
         */
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * Télécharge un blob (ex: PDF ou CSV)
         */
        downloadBlob(blob, filename) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        },

        /**
         * Affiche une boîte de dialogue native de confirmation
         */
        confirmDialog(msg) {
            return new Promise((resolve) => {
                resolve(window.confirm(msg));
            });
        }
    };
})();
