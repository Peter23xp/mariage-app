"""
Routeur FastAPI pour la génération de QR codes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import qrcode
import uuid
import os
import logging
from typing import Dict, Any

from database import ajouter_invite

router = APIRouter(tags=["Génération"])

# Modèles Pydantic pour la validation des données
class GenerateQRRequest(BaseModel):
    nom_invite: str
    couple_nom: str
    table_numero: str

class GenerateQRResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: str

QR_DIR = os.path.join("outputs", "qrcodes")
os.makedirs(QR_DIR, exist_ok=True)

@router.post("/generate-qr", response_model=GenerateQRResponse)
def generate_qr(request: GenerateQRRequest):
    """
    Génère un QR code unique pour un invité, le sauvegarde en image PNG
    et l'enregistre en base de données.
    """
    # Génération d'un suffixe unique non prédictible via uuid4 (6 caractères)
    unique_id = uuid.uuid4().hex[:6].upper()
    code_qr = f"MAR2026-{unique_id}"
    
    # 1. Enregistrement en base de données
    success = ajouter_invite(
        code_qr=code_qr,
        nom_invite=request.nom_invite,
        couple_nom=request.couple_nom,
        table_numero=request.table_numero
    )
    
    if not success:
        # En cas d'erreur de base de données (ex: collision extrêmement rare)
        raise HTTPException(status_code=500, detail="Impossible d'ajouter l'invité dans la base de données.")
        
    # 2. Génération de l'image du QR code
    try:
        # Utilisation de ERROR_CORRECT_H (30% de correction d'erreur, lisible même endommagé)
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(code_qr)
        qr.make(fit=True)
        
        # Création et sauvegarde de l'image
        img = qr.make_image(fill_color="black", back_color="white")
        filepath = os.path.join(QR_DIR, f"{code_qr}.png")
        img.save(filepath)
        logging.info(f"QR code image générée avec succès: {filepath}")
        
    except Exception as e:
        logging.error(f"Erreur lors de la génération de l'image QR pour {code_qr}: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur de génération d'image: {str(e)}")
        
    # 3. Retour structuré JSON
    return GenerateQRResponse(
        success=True,
        data={
            "code_qr": code_qr,
            "nom_invite": request.nom_invite,
            "image_path": filepath
        },
        message="QR code généré et invité ajouté avec succès."
    )
