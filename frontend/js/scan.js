/**
 * scan.js
 * Cœur du système de scan. Gère le polling vidéo, les événements SSE (Server-Sent Events),
 * et les animations CSS de la page principale (Overlay).
 */

document.addEventListener('DOMContentLoaded', () => {
    // === VÉRIFICATION DU CONTEXTE ===
    // Ce script ne doit tourner que sur la page d'accueil (index.html)
    const isScanPage = document.getElementById('camera-feed') !== null;
    if (!isScanPage) return;

    // === CONSTANTES & ÉLÉMENTS DOM ===
    const POLL_INTERVAL = 5000; // 5 secondes
    
    const els = {
        clockTime: document.getElementById('system-clock'),
        clockDate: document.getElementById('system-date'),
        
        camStatusBadge: document.getElementById('camera-status'),
        camImage: document.getElementById('camera-feed'),
        
        statTotal: document.getElementById('counter-total'),
        statEntered: document.getElementById('counter-entered'),
        statProgress: document.getElementById('counter-progress'),
        
        // Overlays de résultats
        overlayMain: document.getElementById('result-overlay'),
        resultValid: document.getElementById('result-valid'),
        resultWarning: document.getElementById('result-warning'),
        resultDanger: document.getElementById('result-danger'),
        
        // Éléments dynamiques des résultats
        resNom: document.getElementById('result-nom-invite'),
        resTable: document.getElementById('result-table-numero'),
        resMessage: document.getElementById('result-message'),
        resDate: document.getElementById('result-date-scan'),
        
        // Portes pour animation
        doorLeft: document.querySelector('.door-left'),
        doorRight: document.querySelector('.door-right'),
        
        // Bouton suivant
        btnNext: document.getElementById('btn-next-scan')
    };

    let resultTimeout = null;
    let evtSource = null;

    // === PARTIE 1 : INITIALISATION ===

    function init() {
        startClock();
        fetchCameraStatus();
        fetchStats();
        setupSSE();

        // Polling régulier des stats et statut caméra
        setInterval(() => {
            fetchCameraStatus();
            fetchStats();
        }, POLL_INTERVAL);

        // Fallback si l'image vidéo crashe
        if (els.camImage) {
            els.camImage.onerror = () => {
                window.utils.showToast("Erreur flux vidéo", "error");
                els.camStatusBadge.textContent = "HORS LIGNE";
                els.camStatusBadge.className = "status-badge status-danger";
            };
        }

        // Fermeture manuelle de l'overlay
        if (els.btnNext) {
            els.btnNext.addEventListener('click', closeResultOverlay);
        }
    }

    function startClock() {
        if (!els.clockTime || !els.clockDate) return;
        
        const update = () => {
            const now = new Date();
            els.clockTime.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            els.clockDate.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        };
        update();
        setInterval(update, 1000);
    }

    async function fetchCameraStatus() {
        if (!els.camStatusBadge) return;
        const res = await window.api.getCameraStatus();
        if (res.success && res.data.available) {
            els.camStatusBadge.textContent = "EN LIGNE";
            els.camStatusBadge.className = "status-badge status-success";
        } else {
            els.camStatusBadge.textContent = "HORS LIGNE";
            els.camStatusBadge.className = "status-badge status-danger";
        }
    }

    async function fetchStats() {
        if (!els.statTotal) return;
        const res = await window.api.getScanStats();
        if (res.success) {
            els.statTotal.textContent = res.data.total_invites;
            els.statEntered.textContent = res.data.deja_entres;
            
            // Calcul barre de progression si l'élément existe
            if (els.statProgress) {
                els.statProgress.style.width = res.data.taux_entree + '%';
            }
        }
    }

    // === PARTIE 2 : SERVER-SENT EVENTS (SSE) ===

    function setupSSE() {
        evtSource = new EventSource('/scan/events');
        
        evtSource.onopen = () => {
            window.utils.showToast("Scanner connecté au serveur.", "success");
        };

        evtSource.onerror = () => {
            window.utils.showToast("Connexion au serveur perdue. Reconnexion...", "error");
        };

        evtSource.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                handleServerEvent(payload.type, payload.data);
            } catch (err) {
                console.error("Erreur parsing SSE :", err);
            }
        };
    }

    function handleServerEvent(type, data) {
        if (type === 'scan_result') {
            afficherResultat(data);
            // Rafraîchissement immédiat des stats sans attendre le polling
            fetchStats();
        } 
        else if (type === 'camera_status') {
            if (els.camStatusBadge) {
                if (data.available) {
                    els.camStatusBadge.textContent = "EN LIGNE";
                    els.camStatusBadge.className = "status-badge status-success";
                    window.utils.showToast("Caméra rebranchée", "info");
                } else {
                    els.camStatusBadge.textContent = "HORS LIGNE";
                    els.camStatusBadge.className = "status-badge status-danger";
                    window.utils.showToast("Caméra déconnectée", "error");
                }
            }
        }
        else if (type === 'system') {
            window.utils.showToast(data.message || data.action, "info");
        }
    }

    // === PARTIE 3 : AFFICHAGE RÉSULTAT ===

    function afficherResultat(data) {
        if (!els.overlayMain) return;

        // Stratégie de REMPLACEMENT IMMÉDIAT : on clear le timer s'il y en a un
        if (resultTimeout) {
            clearTimeout(resultTimeout);
        }

        // 1. Cacher tous les états
        if(els.resultValid) els.resultValid.classList.add('hidden');
        if(els.resultWarning) els.resultWarning.classList.add('hidden');
        if(els.resultDanger) els.resultDanger.classList.add('hidden');

        // Reset animations
        if (els.doorLeft) els.doorLeft.classList.remove('open');
        if (els.doorRight) els.doorRight.classList.remove('open');

        // 2. Remplir les données et choisir l'état
        if (data.statut === 'valide') {
            // -- SCÉNARIO: VALIDE --
            if(els.resNom) els.resNom.textContent = data.nom_invite;
            if(els.resTable) els.resTable.textContent = `Table ${data.table_numero || '?'}`;
            if(els.resultValid) els.resultValid.classList.remove('hidden');
            
            // Lancer animations Valid
            setTimeout(() => {
                if (els.doorLeft) els.doorLeft.classList.add('open');
                if (els.doorRight) els.doorRight.classList.add('open');
                // L'animation bounce est gérée en CSS sur l'icône si on lui ajoute une classe
                const icon = els.resultValid.querySelector('.icon-circle');
                if (icon) {
                    icon.classList.remove('animate-bounce');
                    void icon.offsetWidth; // Trigger reflow
                    icon.classList.add('animate-bounce');
                }
            }, 50);

            // TODO PHASE 4: Son bienvenue.mp3
        } 
        else if (data.statut === 'deja_utilise') {
            // -- SCÉNARIO: DÉJÀ ENTRÉ (WARNING) --
            if(els.resultWarning) els.resultWarning.classList.remove('hidden');
            const warnNom = document.getElementById('warning-nom-invite');
            if(warnNom) warnNom.textContent = data.nom_invite;
            if(els.resDate) els.resDate.textContent = window.utils.formatTime(data.date_scan);
            
            // Lancer animations Warning
            const icon = els.resultWarning.querySelector('.icon-circle');
            if (icon) {
                icon.classList.remove('animate-pulse');
                void icon.offsetWidth;
                icon.classList.add('animate-pulse');
            }

            // TODO PHASE 4: Son alerte douce.mp3
        } 
        else {
            // -- SCÉNARIO: INVALIDE (DANGER) --
            if(els.resultDanger) els.resultDanger.classList.remove('hidden');
            if(els.resMessage) els.resMessage.textContent = data.message || "Ce QR code n'existe pas dans la base de données.";
            
            // Lancer animations Danger
            const icon = els.resultDanger.querySelector('.icon-circle');
            if (icon) {
                icon.classList.remove('animate-shake');
                void icon.offsetWidth;
                icon.classList.add('animate-shake');
            }

            // TODO PHASE 4: Son alerte forte.mp3
        }

        // 3. Afficher l'overlay principal
        els.overlayMain.classList.remove('hidden');

        // 4. Programmer la fermeture automatique après 5 secondes
        resultTimeout = setTimeout(() => {
            closeResultOverlay();
        }, 5000);
    }

    function closeResultOverlay() {
        if (!els.overlayMain) return;
        els.overlayMain.classList.add('hidden');
        if (els.doorLeft) els.doorLeft.classList.remove('open');
        if (els.doorRight) els.doorRight.classList.remove('open');
        if (resultTimeout) {
            clearTimeout(resultTimeout);
            resultTimeout = null;
        }
    }

    // GO
    init();
});
