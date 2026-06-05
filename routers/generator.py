"""
Routeur FastAPI pour la génération de QR codes.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import qrcode
import uuid
import os
import io
import logging
from typing import Dict, Any

import database
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


def _generer_pdf_pour_invite(invite: dict) -> bytes:
    """
    Génère un PDF simple contenant le QR code et les infos de l'invité.
    Utilise reportlab si disponible, sinon retourne l'image PNG brute.
    """
    code_qr = invite.get("code_qr", "")
    nom = invite.get("nom_invite", "Invité")
    couple = invite.get("couple_nom", "")
    table = invite.get("table_numero", "")
    
    qr_path = os.path.join(QR_DIR, f"{code_qr}.png")
    
    # Si l'image n'existe pas, on la regénère
    if not os.path.exists(qr_path):
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
        qr.add_data(code_qr)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(qr_path)
    
    try:
        # Tentative avec reportlab pour un vrai PDF
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.pdfgen import canvas
        
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        largeur, hauteur = A4
        
        # Titre
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(largeur / 2, hauteur - 3 * cm, "Invitation Mariage")
        
        # Infos invité
        c.setFont("Helvetica", 14)
        c.drawCentredString(largeur / 2, hauteur - 5 * cm, f"Invité(e) : {nom}")
        if couple:
            c.drawCentredString(largeur / 2, hauteur - 6 * cm, f"Mariage de : {couple}")
        if table:
            c.drawCentredString(largeur / 2, hauteur - 7 * cm, f"Table n° : {table}")
        
        # Image QR code (centré)
        qr_size = 7 * cm
        x = (largeur - qr_size) / 2
        y = hauteur / 2 - qr_size / 2
        c.drawImage(qr_path, x, y, width=qr_size, height=qr_size)
        
        # Code texte sous le QR
        c.setFont("Helvetica", 10)
        c.drawCentredString(largeur / 2, y - 0.8 * cm, code_qr)
        
        c.save()
        buf.seek(0)
        return buf.read()
        
    except ImportError:
        # Fallback : retourner l'image PNG si reportlab n'est pas installé
        logging.warning("reportlab non installé — retour du fichier PNG en guise de PDF")
        with open(qr_path, "rb") as f:
            return f.read()


@router.post("/generator/pdf/{invite_id}")
def generer_pdf_invite(invite_id: int):
    """
    Génère un PDF d'invitation pour un invité donné par son ID.
    Retourne le fichier en téléchargement direct.
    """
    invite = database.get_invite_par_id(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail=f"Invité {invite_id} introuvable.")
    
    contenu = _generer_pdf_pour_invite(invite)
    nom_fichier = f"Invitation_{invite.get('nom_invite', invite_id)}.pdf"
    
    return StreamingResponse(
        io.BytesIO(contenu),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'}
    )


@router.post("/generator/pdf-all")
def generer_pdf_tous():
    """
    Génère un ZIP contenant les PDFs de tous les invités.
    """
    import zipfile
    
    invites = database.get_tous_invites()
    if not invites:
        raise HTTPException(status_code=404, detail="Aucun invité en base de données.")
    
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for invite in invites:
            try:
                contenu = _generer_pdf_pour_invite(invite)
                nom = invite.get("nom_invite", "invite").replace(" ", "_")
                zf.writestr(f"Invitation_{nom}.pdf", contenu)
            except Exception as e:
                logging.error(f"Erreur PDF pour {invite.get('id')}: {e}")
    
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=\"invitations_mariage.zip\""}
    )
