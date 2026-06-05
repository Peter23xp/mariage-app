/**
 * utils.js
 * Helpers globaux pour l'application Mariage.
 * Expose l'objet window.utils.
 */

(function() {
    // === Composant Toast CSS (Injecté dynamiquement) ===
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
        /* Mintlify-style toasts — flat, pill, hairline border */
        #toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        }
        .toast-msg {
            pointer-events: auto;
            min-width: 260px;
            max-width: 380px;
            padding: 12px 16px;
            border-radius: 9999px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.4;
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0;
            transform: translateY(12px) scale(0.97);
            animation: toast-in 0.2s ease forwards;
            background: #FFFFFF;
            color: #0F172A;
            border: 1px solid #E5E7EB;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
        }
        /* Colored left dot indicator */
        .toast-msg::before {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .toast-msg.success { border-color: rgba(0,212,164,0.3); }
        .toast-msg.success::before { background: #00D4A4; }
        .toast-msg.error { border-color: rgba(239,68,68,0.25); }
        .toast-msg.error::before { background: #EF4444; }
        .toast-msg.info { border-color: #E5E7EB; }
        .toast-msg.info::before { background: #94A3B8; }
        .toast-msg.fade-out {
            animation: toast-out 0.18s ease forwards;
        }
        @keyframes toast-in {
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-out {
            to { opacity: 0; transform: translateY(8px) scale(0.96); }
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
