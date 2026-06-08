"""
Point d'entrée principal de l'application FastAPI.
"""
import os
os.environ["OPENCV_LOG_LEVEL"] = "FATAL"
os.environ["OPENCV_VIDEOIO_DEBUG"] = "0"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import logging
import os
import sys
import asyncio
import socket
import webbrowser
import threading

# Correction du répertoire de travail pour l'exécutable PyInstaller
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))

from database import init_db
from routers import admin, generator, invites, scan, mobile
from events import broadcaster
from scanner import scanner

# Config du logger pour la console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_local_ip():
    """Récupère l'adresse IP locale de la machine."""
    try:
        # Créer une connexion socket pour trouver l'IP locale
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # On se connecte à un serveur externe (pas besoin d'envoyer de données)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

def open_browser(url, delay=2):
    """Ouvre le navigateur après un délai pour laisser le serveur démarrer."""
    def _open():
        import time
        time.sleep(delay)
        try:
            webbrowser.open(url)
            logging.info(f"Navigateur ouvert : {url}")
        except Exception as e:
            logging.error(f"Impossible d'ouvrir le navigateur : {e}")
    
    thread = threading.Thread(target=_open, daemon=True)
    thread.start()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application (démarrage / arrêt)."""
    logging.info("Démarrage de l'application... Initialisation de la base de données.")
    init_db()
    
    # S'assurer que le dossier des QR codes existe
    os.makedirs("outputs/qrcodes", exist_ok=True)
    
    # Configuration SSE
    broadcaster.set_loop(asyncio.get_running_loop())
    
    # Démarrage de la capture vidéo en arrière-plan
    scanner.start()
    
    yield
    
    # Arrêt propre
    scanner.stop()
    logging.info("Arrêt de l'application.")

app = FastAPI(title="Mariage App", lifespan=lifespan)

# Inclusion des routeurs
app.include_router(admin.router)
app.include_router(generator.router)
app.include_router(invites.router)
app.include_router(scan.router)
app.include_router(mobile.router)  # Scan mobile via caméra smartphone

# On monte le dossier static pour servir les images qrcodes
app.mount("/qrcodes", StaticFiles(directory="outputs/qrcodes"), name="qrcodes")
# On monte les dossiers frontend static
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

# Routes HTML directes pour l'UI SPA (Single Page Application)
@app.get("/")
def serve_welcome_display():
    """Écran de bienvenue - PAGE PAR DÉFAUT"""
    return FileResponse("frontend/welcome_display.html")

@app.get("/scan.html")
def serve_scan():
    """Interface de scan (anciennement à la racine)"""
    return FileResponse("frontend/index.html")

@app.get("/admin.html")
def serve_admin():
    return FileResponse("frontend/admin.html")

@app.get("/tables.html")
def serve_tables():
    """Plan de table interactif"""
    return FileResponse("frontend/tables.html")

@app.get("/login.html")
def serve_login():
    return FileResponse("frontend/login.html")

@app.get("/welcome_display.html")
def serve_welcome_display_alt():
    """Alias pour compatibilité"""
    return FileResponse("frontend/welcome_display.html")

# Route API pour obtenir les informations réseau
@app.get("/api/network-info")
def get_network_info():
    """Retourne l'IP locale et le port du serveur."""
    local_ip = get_local_ip()
    # Détecter le port depuis la configuration
    import os
    if os.path.exists("ssl/cert.pem") and os.path.exists("ssl/key.pem"):
        port = 8888
        protocol = "https"
    else:
        port = 8000
        protocol = "http"
    
    return {
        "local_ip": local_ip,
        "port": port,
        "protocol": protocol,
        "urls": {
            "welcome": f"{protocol}://{local_ip}:{port}/",
            "scan": f"{protocol}://{local_ip}:{port}/scan.html",
            "admin": f"{protocol}://{local_ip}:{port}/admin.html",
            "login": f"{protocol}://{local_ip}:{port}/login.html"
        }
    }
    return FileResponse("frontend/welcome_display.html")

# Routes de test supprimées (Étape 5)
# Les résultats sont maintenant intégrés dans l'overlay de index.html

if __name__ == "__main__":
    # ----------------------------------------------------------------
    # HTTPS (requis pour getUserMedia sur iPhone/iOS Safari)
    # Génère le certificat d'abord : python generate_ssl_cert.py
    # ----------------------------------------------------------------
    SSL_CERT = "ssl/cert.pem"
    SSL_KEY  = "ssl/key.pem"
    
    # Récupérer l'IP locale pour l'affichage
    local_ip = get_local_ip()

    if os.path.exists(SSL_CERT) and os.path.exists(SSL_KEY):
        port = 8888
        protocol = "https"
        logging.info("SSL cert found -> starting HTTPS on port %d", port)
        print("\n" + "="*60)
        print(f"✅ SERVEUR DÉMARRÉ AVEC SUCCÈS (HTTPS)")
        print(f"🌍 Écran de Bienvenue : https://{local_ip}:{port}/")
        print(f"📸 Scanner QR Code    : https://{local_ip}:{port}/scan.html")
        print(f"⚙️ Administration      : https://{local_ip}:{port}/admin.html")
        print(f"🔐 Page de Connexion  : https://{local_ip}:{port}/login.html")
        print("="*60 + "\n")
        
        # Ouvrir automatiquement l'écran de bienvenue dans le navigateur
        welcome_url = f"https://{local_ip}:{port}/"
        logging.info("Ouverture automatique de l'écran de bienvenue...")
        open_browser(welcome_url, delay=3)
        
        uvicorn.run(
            "main:app",
            host=local_ip,
            port=port,
            reload=False,          # reload=True incompatible avec SSL sur uvicorn
            ssl_certfile=SSL_CERT,
            ssl_keyfile=SSL_KEY,
            log_level="info"       # Affiche les logs en temps réel (accès aux pages, etc.)
        )
    else:
        port = 8000
        protocol = "http"
        logging.warning(
            "Aucun certificat SSL trouve (ssl/cert.pem). "
            "Demarrage en HTTP sur le port %d. "
            "La camera iPhone ne fonctionnera PAS. "
            "Executez : python generate_ssl_cert.py", port
        )
        print("\n" + "="*60)
        print(f"✅ SERVEUR DÉMARRÉ AVEC SUCCÈS (HTTP)")
        print(f"🌍 Écran de Bienvenue : http://{local_ip}:{port}/")
        print(f"📸 Scanner QR Code    : http://{local_ip}:{port}/scan.html")
        print(f"⚙️ Administration      : http://{local_ip}:{port}/admin.html")
        print(f"🔐 Page de Connexion  : http://{local_ip}:{port}/login.html")
        print("="*60 + "\n")
        
        # Ouvrir automatiquement l'écran de bienvenue dans le navigateur
        welcome_url = f"http://{local_ip}:{port}/"
        logging.info("Ouverture automatique de l'écran de bienvenue...")
        open_browser(welcome_url, delay=2)
        
        uvicorn.run("main:app", host=local_ip, port=port, reload=True, log_level="info")


