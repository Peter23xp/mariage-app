"""
routers/mobile.py
Endpoints pour le scan mobile via caméra smartphone.

- GET /scan-mobile        → page HTML mobile-first
- GET /qr-reseau          → QR code PNG pointant vers /scan-mobile
- GET /api/local-ip       → renvoie l'IP locale du serveur (pour l'UI desktop)
"""

import io
import socket
import logging
import os
import qrcode

from fastapi import APIRouter
from fastapi.responses import FileResponse, Response, JSONResponse

logger = logging.getLogger("mobile")

router = APIRouter(tags=["Mobile"])

# Détection automatique : HTTPS si le certificat SSL existe
SSL_CERT = "ssl/cert.pem"

def _get_scheme_and_port() -> tuple[str, int]:
    """Renvoie (scheme, port) selon que le certificat SSL est present ou non."""
    if os.path.exists(SSL_CERT):
        return "https", 8888
    return "http", 8000


def get_local_ip() -> str:
    """
    Détecte l'IP locale Wi-Fi du serveur.
    Utilise une connexion UDP fictive vers 8.8.8.8 pour trouver l'interface réseau active.
    Ne crée aucun trafic réseau réel.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(0)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
        return ip
    except Exception:
        # Fallback : nom d'hôte résolu localement
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


@router.get("/scan-mobile", include_in_schema=False)
def serve_scan_mobile():
    """Sert la page de scan mobile (mobile-first, caméra + jsQR)."""
    return FileResponse("frontend/scan_mobile.html")


@router.get("/qr-reseau", responses={200: {"content": {"image/png": {}}}})
def qr_reseau():
    """
    Génère et renvoie un QR code PNG pointant vers la page de scan mobile.
    Ce QR code doit être scanné UNE SEULE FOIS au démarrage pour connecter le téléphone.
    """
    ip = get_local_ip()
    scheme, port = _get_scheme_and_port()
    url = f"{scheme}://{ip}:{port}/scan-mobile"
    logger.info(f"Génération du QR réseau → {url}")

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return Response(content=buf.read(), media_type="image/png")


@router.get("/api/local-ip")
def api_local_ip():
    """Renvoie l'IP locale du serveur pour affichage dans l'interface desktop."""
    ip = get_local_ip()
    scheme, port = _get_scheme_and_port()
    url_mobile = f"{scheme}://{ip}:{port}/scan-mobile"
    return JSONResponse({
        "success": True,
        "ip": ip,
        "port": port,
        "scheme": scheme,
        "url_mobile": url_mobile,
        "https_enabled": scheme == "https",
    })
