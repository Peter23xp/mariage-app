"""
Point d'entrée principal de l'application FastAPI.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import logging
import os
import asyncio

from database import init_db
from routers import admin, generator, invites, scan
from events import broadcaster
from scanner import scanner

# Config du logger pour la console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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

# On monte le dossier static pour servir les images qrcodes
app.mount("/qrcodes", StaticFiles(directory="outputs/qrcodes"), name="qrcodes")
# On monte les dossiers frontend static
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

# Routes HTML directes pour l'UI SPA (Single Page Application)
@app.get("/")
def serve_index():
    return FileResponse("frontend/index.html")

@app.get("/admin.html")
def serve_admin():
    return FileResponse("frontend/admin.html")

@app.get("/login.html")
def serve_login():
    return FileResponse("frontend/login.html")

# Routes de test supprimées (Étape 5)
# Les résultats sont maintenant intégrés dans l'overlay de index.html

if __name__ == "__main__":
    # Lancement du serveur uvicorn de manière programmatique
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
