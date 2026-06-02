"""
Configurations de l'application de mariage.
Centralise toutes les constantes pour éviter les valeurs codées en dur.
"""

# ==========================================
# CAMÉRA ET SCANNER
# ==========================================
CAMERA_INDEX = 0                  # Index de la webcam par défaut (0 = principale)
FPS_TARGET = 25                   # Images par seconde ciblées pour la lecture vidéo
VIDEO_STREAM_FPS = 25             # Images par seconde pour la diffusion MJPEG
JPEG_QUALITY = 80                 # Qualité de compression pour le stream MJPEG
ANTI_DOUBLE_SCAN_DELAY = 2.0      # Délai (en secondes) avant de pouvoir rescanner le MÊME code QR

# ==========================================
# SERVER-SENT EVENTS (SSE)
# ==========================================
SSE_KEEPALIVE_INTERVAL = 15       # Intervalle (en s) de ping pour maintenir la connexion SSE ouverte

# ==========================================
# INTERFACE UTILISATEUR (UI)
# ==========================================
RESULT_DISPLAY_DURATION = 5       # Durée d'affichage (en s) de la popup de résultat de scan

# ==========================================
# BASE DE DONNÉES
# ==========================================
DB_RETRY_COUNT = 3                # Nombre de tentatives en cas de "database is locked"
DB_RETRY_DELAY_MS = 100           # Délai entre chaque retry (en millisecondes)
