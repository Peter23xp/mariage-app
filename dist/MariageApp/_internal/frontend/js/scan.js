/**
 * scan.js
 * Cœur du système de scan. Gère le polling vidéo, les événements SSE (Server-Sent Events),
 * et les animations CSS de la page principale (Overlay).
 *
 * IDs DOM (index.html) :
 *   #scan-result-overlay       → overlay principal
 *   .result-valid / .result-warning / .result-danger  → blocs état
 *   #result-name               → nom invité (état valide)
 *   #result-table              → numéro table (état valide)
 *   #result-time               → heure entrée (état valide)
 *   #result-warning-name       → nom invité (état warning)
 *   #result-first-scan         → date premier scan (état warning)
 *   #result-invalid-code       → code invalide (état danger)
 */

document.addEventListener('DOMContentLoaded', () => {
    // === VÉRIFICATION DU CONTEXTE ===
    const isScanPage = document.getElementById('camera-feed') !== null;
    if (!isScanPage) return;

    // === CONSTANTES & ÉLÉMENTS DOM ===
    const POLL_INTERVAL = 5000; // 5 secondes

    const els = {
        clockTime: document.getElementById('system-clock'),
        clockDate: document.getElementById('system-date'),

        camStatusBadge: document.getElementById('camera-status'),
        camImage:       document.getElementById('camera-feed'),

        statTotal:    document.getElementById('counter-total'),
        statEntered:  document.getElementById('counter-entered'),
        statProgress: document.getElementById('counter-progress'),
        progressLabel: document.getElementById('progress-label'),

        // Overlay principal (scan-result-overlay dans index.html)
        overlayMain: document.getElementById('scan-result-overlay'),

        // Blocs d'état (sélection par classe dans l'overlay)
        resultValid:   document.querySelector('.result-valid'),
        resultWarning: document.querySelector('.result-warning'),
        resultDanger:  document.querySelector('.result-danger'),

        // Champs dynamiques — VALIDE
        resNom:   document.getElementById('result-name'),
        resRole:  document.getElementById('result-role-badge'),
        resTable: document.getElementById('result-table'),
        resAccomp: document.getElementById('result-accomp'),
        resRegime: document.getElementById('result-regime'),
        resTime:  document.getElementById('result-time'),

        // Champs dynamiques — DÉJÀ UTILISÉ
        resWarningNom:  document.getElementById('result-warning-name'),
        resFirstScan:   document.getElementById('result-first-scan'),

        // Champs dynamiques — INVALIDE
        resInvalidCode: document.getElementById('result-invalid-code'),
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

        // Fermeture de l'overlay au clic sur l'overlay lui-même
        if (els.overlayMain) {
            els.overlayMain.addEventListener('click', closeResultOverlay);
        }
    }

    function startClock() {
        if (!els.clockTime || !els.clockDate) return;

        const update = () => {
            const now = new Date();
            els.clockTime.textContent = now.toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            els.clockDate.textContent = now.toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
        };
        update();
        setInterval(update, 1000);
    }

    async function fetchCameraStatus() {
        if (!els.camStatusBadge) return;
        try {
            const res = await window.api.getCameraStatus();
            const badge = els.camStatusBadge;
            if (res.success && res.data.available) {
                badge.dataset.status = 'online';
                badge.querySelector('.status-icon').textContent = '🟢';
                badge.querySelector('.status-text').textContent = 'Caméra EN LIGNE';
            } else {
                badge.dataset.status = 'offline';
                badge.querySelector('.status-icon').textContent = '🔴';
                badge.querySelector('.status-text').textContent = 'Caméra HORS LIGNE';
            }
        } catch {
            if (els.camStatusBadge) {
                els.camStatusBadge.dataset.status = 'offline';
            }
        }
    }

    async function fetchStats() {
        if (!els.statTotal) return;
        try {
            const res = await window.api.getScanStats();
            if (res.success) {
                els.statTotal.textContent   = res.data.total_invites;
                els.statEntered.textContent = res.data.deja_entres;

                if (els.statProgress) {
                    const pct = res.data.taux_entree || 0;
                    els.statProgress.value = pct;
                    els.statProgress.max   = 100;
                }
                if (els.progressLabel) {
                    els.progressLabel.textContent = (res.data.taux_entree || 0) + '%';
                }
            }
        } catch { /* silencieux */ }
    }

    // === PARTIE 2 : SERVER-SENT EVENTS (SSE) ===

    function setupSSE() {
        evtSource = new EventSource('/scan/events');

        evtSource.onopen = () => {
            if (window.utils && window.utils.showToast) {
                window.utils.showToast('Scanner connecté au serveur.', 'success');
            }
        };

        evtSource.onerror = () => {
            if (window.utils && window.utils.showToast) {
                window.utils.showToast('Connexion au serveur perdue. Reconnexion...', 'error');
            }
        };

        evtSource.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                handleServerEvent(payload.type, payload.data);
            } catch (err) {
                console.error('Erreur parsing SSE :', err);
            }
        };
    }

    function handleServerEvent(type, data) {
        if (type === 'scan_result') {
            afficherResultat(data);
            fetchStats();  // Rafraîchissement immédiat des stats
        }
        else if (type === 'camera_status') {
            fetchCameraStatus();
        }
        else if (type === 'system') {
            if (window.utils && window.utils.showToast) {
                window.utils.showToast(data.message || data.action, 'info');
            }
        }
    }

    // === PARTIE AUDIO ===
    let audioCtx = null;
    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
    document.addEventListener('click', initAudio, { once: true });

    function playSound(type) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        if (type === 'valide') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
            osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.6);
        } else if (type === 'invalide') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'deja_utilise') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
            gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.15);
            gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.25);
        }
    }

    // === PARTIE 3 : AFFICHAGE RÉSULTAT ===

    function afficherResultat(data) {
        if (!els.overlayMain) {
            console.warn('scan.js: #scan-result-overlay introuvable dans le DOM.');
            return;
        }

        // Clear timer précédent (remplacement immédiat)
        if (resultTimeout) {
            clearTimeout(resultTimeout);
            resultTimeout = null;
        }

        // 1. Masquer tous les états
        [els.resultValid, els.resultWarning, els.resultDanger].forEach(el => {
            if (el) el.classList.add('hidden');
        });

        // 2. Extraire info communes
        const statut = data.statut;
        
        playSound(statut);

        const maintenant = new Date();
        const heure  = maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (statut === 'valide') {
            if (els.resNom)   els.resNom.textContent   = data.nom_invite || '—';
            if (els.resTable) els.resTable.textContent = data.table_numero || '?';
            if (els.resTime)  els.resTime.textContent  = heure;
            
            if (els.resRole) {
                if (data.role === 'vip') {
                    els.resRole.textContent = 'VIP';
                    els.resRole.classList.remove('hidden');
                    els.resRole.style.background = 'var(--color-brand-warn)';
                } else if (data.role === 'temoin') {
                    els.resRole.textContent = 'Témoin';
                    els.resRole.classList.remove('hidden');
                    els.resRole.style.background = '#3b82f6';
                } else if (data.role === 'famille') {
                    els.resRole.textContent = 'Famille';
                    els.resRole.classList.remove('hidden');
                    els.resRole.style.background = '#8b5cf6';
                } else {
                    els.resRole.classList.add('hidden');
                }
            }
            
            if (els.resAccomp) {
                if (data.accompagnants > 0) {
                    els.resAccomp.textContent = `👥 +${data.accompagnants} accompagnants`;
                    els.resAccomp.classList.remove('hidden');
                } else {
                    els.resAccomp.classList.add('hidden');
                }
            }
            
            if (els.resRegime) {
                if (data.regime_alimentaire && data.regime_alimentaire !== 'Aucun') {
                    els.resRegime.textContent = `🍽️ ${data.regime_alimentaire}`;
                    els.resRegime.classList.remove('hidden');
                } else {
                    els.resRegime.classList.add('hidden');
                }
            }

            if (els.resultValid) els.resultValid.classList.remove('hidden');
        }
        else if (statut === 'deja_utilise') {
            if (els.resWarningNom) els.resWarningNom.textContent = data.nom_invite || '—';
            if (els.resFirstScan) {
                // Formatage date_scan (ISO → lisible)
                const d = data.date_scan ? new Date(data.date_scan) : null;
                els.resFirstScan.textContent = d
                    ? d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : 'date inconnue';
            }
            if (els.resultWarning) els.resultWarning.classList.remove('hidden');
        }
        else {
            // Invalide
            if (els.resInvalidCode) els.resInvalidCode.textContent = data.code_qr || '—';
            if (els.resultDanger) els.resultDanger.classList.remove('hidden');
        }

        // 3. Afficher l'overlay
        els.overlayMain.classList.remove('hidden');
        els.overlayMain.dataset.state = statut;

        // 4. Fermeture automatique après 5 s
        resultTimeout = setTimeout(closeResultOverlay, 5000);
    }

    function closeResultOverlay() {
        if (!els.overlayMain) return;
        els.overlayMain.classList.add('hidden');
        els.overlayMain.dataset.state = 'idle';
        if (resultTimeout) {
            clearTimeout(resultTimeout);
            resultTimeout = null;
        }
    }

    // === PARTIE 4 : PANNEAU CONNEXION MOBILE ===

    function initMobilePanel() {
        const toggleBtn  = document.getElementById('mobile-panel-toggle');
        const panelBody  = document.getElementById('mobile-panel-body');
        const toggleIcon = document.getElementById('mobile-toggle-icon');
        const urlText    = document.getElementById('mobile-url-text');

        if (!toggleBtn || !panelBody) return;

        // Toggle collapse / expand
        toggleBtn.addEventListener('click', () => {
            const isHidden = panelBody.hasAttribute('hidden');
            if (isHidden) {
                panelBody.removeAttribute('hidden');
                toggleBtn.setAttribute('aria-expanded', 'true');
                if (toggleIcon) toggleIcon.textContent = '▴';
            } else {
                panelBody.setAttribute('hidden', '');
                toggleBtn.setAttribute('aria-expanded', 'false');
                if (toggleIcon) toggleIcon.textContent = '▾';
            }
        });

        // Fetch IP locale depuis le backend
        fetch('/api/local-ip')
            .then(r => r.json())
            .then(data => {
                if (data.success && urlText) {
                    urlText.textContent = data.url_mobile;
                }
            })
            .catch(() => {
                if (urlText) urlText.textContent = 'IP non disponible';
            });
    }

    // === RESET SCANNER ===

    function initResetButton() {
        const btnReset = document.getElementById('btn-reset');
        if (!btnReset) return;

        // Afficher le bouton reset seulement si URL contient ?debug=1
        if (new URLSearchParams(window.location.search).has('debug')) {
            btnReset.classList.remove('hidden');
            btnReset.addEventListener('click', async () => {
                try {
                    await fetch('/scan/reset', { method: 'POST' });
                    if (window.utils && window.utils.showToast) {
                        window.utils.showToast('Scanner réinitialisé', 'info');
                    }
                } catch { /* silencieux */ }
            });
        }
    }

    // GO
    init();
    initMobilePanel();
    initResetButton();
});
