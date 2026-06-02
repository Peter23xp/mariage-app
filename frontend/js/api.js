/**
 * api.js
 * Couche d'accès centralisée au backend FastAPI.
 * Expose l'objet window.api.
 */

(function() {
    const DEBUG_MODE = false;

    // Helper interne pour logger
    function log(...args) {
        if (DEBUG_MODE) console.log('[API]', ...args);
    }

    /**
     * Méthode interne standardisée pour faire les appels fetch
     */
    async function _fetch(endpoint, options = {}) {
        const url = endpoint; // On suppose que le backend sert les fichiers et l'API sur le même domaine
        
        // Timeout de 10 secondes par défaut
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        options.signal = controller.signal;
        
        try {
            log(`Fetching ${url}`, options);
            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            // Gère les blobs (téléchargements)
            const contentType = response.headers.get("content-type");
            if (contentType && (contentType.includes("application/pdf") || contentType.includes("text/csv") || contentType.includes("application/zip"))) {
                if (!response.ok) throw new Error(`Erreur de téléchargement: ${response.status}`);
                return { success: true, isBlob: true, blob: await response.blob() };
            }

            const data = await response.json();
            
            if (!response.ok) {
                // Tente de récupérer l'erreur détaillée fournie par FastAPI (HTTPException detail)
                const errorMsg = data.detail || data.message || `Erreur serveur (${response.status})`;
                return { success: false, message: errorMsg, data: null };
            }

            return { 
                success: data.success !== undefined ? data.success : true, 
                data: data.data || data, 
                message: data.message || '' 
            };

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                return { success: false, message: "Le serveur met trop de temps à répondre (Timeout)." };
            }
            log("Fetch Error:", error);
            return { success: false, message: "Impossible de contacter le serveur. Vérifiez votre connexion." };
        }
    }

    window.api = {
        // ==========================
        // ENDPOINTS SCAN / CAMERA
        // ==========================
        
        async getCameraStatus() {
            return _fetch('/scan/status-camera');
        },
        
        async getScanStats() {
            return _fetch('/scan/stats');
        },
        
        async manualScan(code_qr) {
            return _fetch('/scan/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_qr })
            });
        },
        
        async resetScanner() {
            return _fetch('/scan/reset', { method: 'POST' });
        },

        // ==========================
        // ENDPOINTS INVITES (CRUD)
        // ==========================
        
        async getInvites(search = '') {
            const url = search ? `/invites?search=${encodeURIComponent(search)}` : '/invites';
            return _fetch(url);
        },
        
        async getInviteById(id) {
            return _fetch(`/invites/${id}`);
        },
        
        async addInvite(inviteData) {
            return _fetch('/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inviteData)
            });
        },
        
        async updateInvite(id, inviteData) {
            return _fetch(`/invites/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inviteData)
            });
        },
        
        async deleteInvite(id) {
            return _fetch(`/invites/${id}`, { method: 'DELETE' });
        },

        // ==========================
        // ENDPOINTS ADMIN
        // ==========================
        
        async login(password) {
            return _fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
        },
        
        async getAdminStats() {
            return _fetch('/admin/stats');
        },
        
        async importCSV(file) {
            const formData = new FormData();
            formData.append('file', file);
            return _fetch('/admin/import-csv', {
                method: 'POST',
                body: formData
            });
        },
        
        async exportCSV() {
            return _fetch('/admin/export-csv');
        },
        
        async resetTestInvites() {
            return _fetch('/admin/reset-invites', { method: 'POST' });
        },

        // ==========================
        // ENDPOINTS GENERATOR
        // ==========================
        
        async generateQR(inviteId) {
            return _fetch(`/generator/qr/${inviteId}`, { method: 'POST' });
        },
        
        async generatePDF(inviteId) {
            return _fetch(`/generator/pdf/${inviteId}`, { method: 'POST' });
        },
        
        async generateAllPDF() {
            return _fetch('/generator/pdf-all', { method: 'POST' });
        }
    };
})();
