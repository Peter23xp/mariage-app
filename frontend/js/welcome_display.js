/**
 * welcome_display.js
 * Gère l'écran de bienvenue avec résultats de scan intégrés
 * Les résultats apparaissent sous la photo du couple dans le même écran
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    coupleNames: 'Sarah & Thomas',
    resultDuration: 8000, // 8 secondes d'affichage du résultat
    particleCount: 50,
    confettiCount: 150,
    apiBaseUrl: window.location.origin
  };

  // État
  let resultTimeout = null;

  // Éléments DOM
  const els = {
    idleScreen: document.getElementById('idle-screen'),
    idleVisuals: document.getElementById('idle-visuals'),
    coupleNames: document.getElementById('couple-names'),
    idleMessage: document.getElementById('idle-message'),
    confettiCanvas: document.getElementById('confetti-canvas'),
    particlesContainer: document.getElementById('particles'),
    // Carte résultat intégrée
    resultCard: document.getElementById('result-card'),
    resultIconRing: document.getElementById('result-icon-ring'),
    resultIconSymbol: document.getElementById('result-icon-symbol'),
    resultGuestName: document.getElementById('result-guest-name'),
    resultMessage: document.getElementById('result-message'),
    resultTableBadge: document.getElementById('result-table-badge'),
    resultTableNumber: document.getElementById('result-table-number'),
    resultProgressFill: document.getElementById('result-progress-fill'),
  };

  // ================================================================
  // INITIALISATION
  // ================================================================

  function init() {
    loadCoupleInfo();
    loadNetworkInfo();
    setupParticles();
    setupSSE();
    
    setInterval(loadNetworkInfo, 30000);
    
    console.log('Écran de bienvenue initialisé (mode intégré)');
  }

  // ================================================================
  // CONFIGURATION DU COUPLE
  // ================================================================

  function loadCoupleInfo() {
    const savedNames = localStorage.getItem('couple_names');
    if (savedNames) {
      CONFIG.coupleNames = savedNames;
    }
    
    els.coupleNames.textContent = CONFIG.coupleNames;
  }

  // ================================================================
  // INFORMATION RÉSEAU
  // ================================================================

  async function loadNetworkInfo() {
    try {
      const response = await fetch('/api/network-info');
      const data = await response.json();
      
      const networkInfoEl = document.getElementById('network-url');
      if (networkInfoEl) {
        networkInfoEl.textContent = `${data.protocol}://${data.local_ip}:${data.port}/`;
        window.networkInfo = data;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des infos réseau:', error);
      const networkInfoEl = document.getElementById('network-url');
      if (networkInfoEl) {
        networkInfoEl.textContent = window.location.origin;
      }
    }
  }

  // ================================================================
  // PARTICULES (ARRIÈRE-PLAN)
  // ================================================================

  function setupParticles() {
    for (let i = 0; i < CONFIG.particleCount; i++) {
      createParticle();
    }
  }

  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    const duration = 10 + Math.random() * 20;
    particle.style.animationDuration = duration + 's';
    particle.style.animationDelay = Math.random() * 5 + 's';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 200 + 'px');
    const size = 2 + Math.random() * 4;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    els.particlesContainer.appendChild(particle);
  }

  // ================================================================
  // SERVER-SENT EVENTS (SSE)
  // ================================================================

  function setupSSE() {
    const sseStatusEl = document.getElementById('sse-status');
    let eventCount = 0;

    function updateDebug(text, color) {
      if (sseStatusEl) {
        sseStatusEl.textContent = text;
        sseStatusEl.style.color = color;
      }
    }

    updateDebug('connexion…', '#f59e0b');

    const eventSource = new EventSource('/scan/events');
    
    eventSource.onopen = () => {
      updateDebug('connecté ✓', '#00D4A4');
      console.log('SSE connecté avec succès');
    };

    eventSource.onmessage = (event) => {
      try {
        eventCount++;
        const payload = JSON.parse(event.data);
        updateDebug(`reçu #${eventCount}: ${payload.type}`, '#00D4A4');
        console.log('SSE reçu:', payload.type, payload.data);
        
        if (payload.type === 'scan_result') {
          const data = payload.data;
          console.log('Scan reçu:', data.statut, data.nom_invite);
          showScanResult(data);
        }
      } catch (error) {
        updateDebug('erreur parse: ' + error.message, '#ef4444');
        console.error('Erreur SSE:', error);
      }
    };
    
    eventSource.onerror = () => {
      updateDebug('déconnecté ✕ (reconnexion…)', '#ef4444');
    };
    
    console.log('SSE: connexion à /scan/events');
  }

  // ================================================================
  // AFFICHAGE DU RÉSULTAT (INTÉGRÉ DANS LE MÊME ÉCRAN)
  // ================================================================

  function showScanResult(data) {
    // Annuler le timeout précédent
    if (resultTimeout) {
      clearTimeout(resultTimeout);
      resultTimeout = null;
    }

    const statut = data.statut;
    const card = els.resultCard;

    // --- Icône et couleurs par statut ---
    const statusConfig = {
      valide: {
        icon: '✓',
        title: `Bienvenue ${data.nom_invite || 'Cher invité'} !`,
        message: data.message || 'Nous sommes ravis de vous accueillir'
      },
      deja_utilise: {
        icon: '⚠',
        title: data.nom_invite || 'Invitation',
        message: data.message || 'Cette invitation a déjà été utilisée'
      },
      invalide: {
        icon: '✕',
        title: 'Code non reconnu',
        message: data.message || 'Ce QR code n\'est pas dans la base de données'
      }
    };

    const cfg = statusConfig[statut] || statusConfig.invalide;

    // --- Remplir le contenu ---
    card.setAttribute('data-status', statut);
    els.resultIconSymbol.textContent = cfg.icon;
    els.resultGuestName.textContent = cfg.title;
    els.resultMessage.textContent = cfg.message;

    // Table badge (visible uniquement pour les scans valides)
    const tableNum = data.table_numero;
    if (statut === 'valide' && tableNum) {
      els.resultTableNumber.textContent = tableNum;
      els.resultTableBadge.classList.add('visible');
    } else {
      els.resultTableBadge.classList.remove('visible');
    }

    // --- Cacher le contenu idle complet, afficher la carte résultat ---
    if (els.idleVisuals) els.idleVisuals.classList.add('hidden');
    card.classList.remove('hidden');

    // Forcer l'animation d'entrée
    card.classList.remove('show-enter');
    void card.offsetWidth; // reflow
    card.classList.add('show-enter');

    // --- Barre de progression auto-close ---
    const fill = els.resultProgressFill;
    if (fill) {
      fill.classList.remove('running');
      fill.style.transform = 'scaleX(1)';
      void fill.offsetWidth;
      fill.style.transitionDuration = CONFIG.resultDuration + 'ms';
      fill.classList.add('running');
      fill.style.transform = 'scaleX(0)';
    }

    // --- Confettis uniquement pour les valides ---
    if (statut === 'valide') {
      launchConfetti();
    }

    // --- Auto-fermeture après délai ---
    resultTimeout = setTimeout(hideScanResult, CONFIG.resultDuration);
  }

  function hideScanResult() {
    if (resultTimeout) {
      clearTimeout(resultTimeout);
      resultTimeout = null;
    }

    // Masquer la carte et réafficher le contenu idle complet
    els.resultCard.classList.add('hidden');
    els.resultCard.classList.remove('show-enter');
    if (els.idleVisuals) els.idleVisuals.classList.remove('hidden');

    // Reset barre de progression
    const fill = els.resultProgressFill;
    if (fill) {
      fill.classList.remove('running');
      fill.style.transform = 'scaleX(1)';
    }
  }

  // ================================================================
  // ANIMATION CONFETTI
  // ================================================================

  function launchConfetti() {
    const canvas = els.confettiCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confetti = [];
    const colors = ['#ffffff', '#fbbf24', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

    for (let i = 0; i < CONFIG.confettiCount; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 100,
        width: 8 + Math.random() * 6,
        height: 12 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        velocityX: (Math.random() - 0.5) * 3,
        velocityY: 2 + Math.random() * 3,
        opacity: 1
      });
    }

    let animationFrame;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let activeConfetti = 0;

      confetti.forEach(c => {
        if (c.y > canvas.height + 50) return;
        activeConfetti++;
        c.x += c.velocityX;
        c.y += c.velocityY;
        c.rotation += c.rotationSpeed;
        c.velocityY += 0.1;
        
        if (c.y > canvas.height - 200) {
          c.opacity = Math.max(0, 1 - (c.y - (canvas.height - 200)) / 200);
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation * Math.PI / 180);
        ctx.globalAlpha = c.opacity;
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
        ctx.restore();
      });

      if (activeConfetti > 0) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animate();

    setTimeout(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 10000);
  }

  // ================================================================
  // REDIMENSIONNEMENT
  // ================================================================

  window.addEventListener('resize', () => {
    if (els.confettiCanvas) {
      els.confettiCanvas.width = window.innerWidth;
      els.confettiCanvas.height = window.innerHeight;
    }
  });

  // ================================================================
  // CONFIGURATION VIA URL PARAMS (optionnel)
  // ================================================================

  function loadURLConfig() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('couple')) {
      CONFIG.coupleNames = decodeURIComponent(params.get('couple'));
      localStorage.setItem('couple_names', CONFIG.coupleNames);
    }
    
    if (params.has('duration')) {
      CONFIG.resultDuration = parseInt(params.get('duration')) * 1000;
    }
  }

  // ================================================================
  // DÉMARRAGE
  // ================================================================

  loadURLConfig();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposition pour debug
  window.welcomeDisplay = {
    showScanResult,
    hideScanResult,
    CONFIG
  };

})();
