import asyncio
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

# Import des composants globaux
from events import broadcaster
from config import SSE_KEEPALIVE_INTERVAL, VIDEO_STREAM_FPS
from scanner import scanner, OFFLINE_FRAME
import database

router = APIRouter(prefix="/scan", tags=["Scan"])

# --- Modèles Pydantic ---
class ScanManualRequest(BaseModel):
    # Validation stricte du format du code QR (MAR2026- suivi de caractères alphanumériques)
    code_qr: str = Field(..., pattern=r"^MAR2026-[A-Z0-9]+$")

class ScanResult(BaseModel):
    """Modèle de réponse standardisé pour les résultats de scan."""
    statut: Literal["valide", "deja_utilise", "invalide"]
    code_qr: str
    nom_invite: Optional[str]
    couple_nom: Optional[str]
    table_numero: Optional[str]
    date_scan: Optional[str]  # Format ISO-8601
    message: str

# --- Endpoints SSE et Vidéo ---

@router.get("/events")
async def sse_events():
    """
    Endpoint SSE (Server-Sent Events).
    Maintient une connexion ouverte pour pousser les événements de la caméra.
    """
    async def event_generator():
        queue = await broadcaster.subscribe()
        try:
            while True:
                event = await queue.get()
                yield {"data": event}
        except asyncio.CancelledError:
            pass
        finally:
            await broadcaster.unsubscribe(queue)

    return EventSourceResponse(event_generator(), ping=SSE_KEEPALIVE_INTERVAL)

@router.get("/video-feed")
async def video_feed():
    """
    Flux MJPEG asynchrone (retour vidéo de la caméra).
    Peut être affiché directement dans une balise <img src="..."> HTML.
    """
    async def video_generator():
        try:
            while True:
                frame_bytes = scanner.get_frame()
                if not frame_bytes:
                    frame_bytes = OFFLINE_FRAME
                    
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                
                await asyncio.sleep(1.0 / VIDEO_STREAM_FPS)
        except asyncio.CancelledError:
            pass
            
    return StreamingResponse(video_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

# --- Endpoints Statut et Contrôle ---

@router.get("/status-camera")
def status_camera():
    """Renvoie l'état détaillé de la caméra et les compteurs internes du scanner."""
    last_frame_age_ms = int((time.time() - scanner.last_frame_time) * 1000) if scanner.last_frame_time > 0 else 0
    stats_dict = scanner.stats.get_dict()
    
    available = scanner.camera_available
    
    return {
        "success": True,
        "data": {
            "available": available,
            "camera_index": scanner.camera_index,
            "fps_target": VIDEO_STREAM_FPS,
            "last_frame_age_ms": last_frame_age_ms,
            "scans_total": stats_dict["scans_total"],
            "scans_valides": stats_dict["scans_valides"],
            "scans_invalides": stats_dict["scans_invalides"],
            "scans_doubles": stats_dict["scans_doubles"]
        },
        "message": "Caméra opérationnelle" if available else "Caméra non détectée"
    }

@router.get("/stats")
def get_invites_stats():
    """Renvoie les statistiques des invités de la base de données."""
    db_stats = database.get_stats()
    total = db_stats["total"]
    entres = db_stats["entres"]
    attente = db_stats["attente"]
    
    taux_entree = 0.0
    if total > 0:
        taux_entree = round((entres / total) * 100, 1)
        
    return {
        "success": True,
        "data": {
            "total_invites": total,
            "deja_entres": entres,
            "en_attente": attente,
            "taux_entree": taux_entree
        }
    }

@router.post("/manual", response_model=ScanResult)
async def manual_scan(request: ScanManualRequest):
    """
    Endpoint de test pour déclencher un scan manuel.
    Utilise le même pipeline que le scan caméra pour garantir la cohérence.
    """
    code = request.code_qr
    
    # Appel direct à _on_qr_detected pour mutualiser la logique
    # Cela déclenche : validation BDD + mise à jour stats + broadcast SSE
    scanner._on_qr_detected(code)
    
    # Récupération des infos pour la réponse HTTP
    resultat = database.get_scan_info(code)
    
    if resultat:
        return ScanResult(**resultat)
    else:
        # Si le code n'existe pas, retourne un résultat invalide
        return ScanResult(
            statut="invalide",
            code_qr=code,
            nom_invite=None,
            couple_nom=None,
            table_numero=None,
            date_scan=None,
            message="Code QR invalide ou non trouvé"
        )

@router.post("/reset")
def reset_scanner():
    """Vide le cache anti-double-scan et réinitialise les stats de la mémoire."""
    scanner.reset_scanner()
    broadcaster.broadcast("system", {"action": "reset_scanner"})
    return {"success": True, "message": "Scanner réinitialisé"}
