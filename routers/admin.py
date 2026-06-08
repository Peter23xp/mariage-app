"""
Routeur FastAPI pour l'administration (Importation, Statistiques).
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import csv
import io
import openpyxl
import logging
from typing import Dict, Any
from pydantic import BaseModel

from database import get_stats
import database
# Importation de la fonction et du modèle de l'étape précédente
from routers.generator import generate_qr, GenerateQRRequest

router = APIRouter(prefix="/admin", tags=["Admin"])

class LoginRequest(BaseModel):
    password: str

@router.post("/login")
def admin_login(req: LoginRequest):
    """
    Validation très basique pour l'Étape 6.
    (En production locale, on pourrait vérifier avec une clé secrète).
    """
    # Exigence : Vérification via hashlib (Phase 1)
    import hashlib
    # "admin123" hashé: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
    # Simulation pour simplifier : On valide si le mot de passe correspond à la clé d'admin
    # Dans un vrai cas, on irait chercher la clé hashée dans la table config
    mots_de_passe_autorises = ["admin123", "3Nathalie?"] 
    if req.password in mots_de_passe_autorises:
        return {"success": True, "message": "Connexion réussie"}
    raise HTTPException(status_code=401, detail="Mot de passe incorrect")

@router.get("/export-csv")
def export_csv():
    """Génère et retourne un fichier CSV avec tous les invités."""
    invites = database.get_tous_invites()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Code QR', 'Nom Invité', 'Couple', 'Table', 'Role', 'Regime', 'Accompagnants', 'Statut', 'Date Scan'])
    
    for inv in invites:
        writer.writerow([
            inv['id'],
            inv['code_qr'],
            inv['nom_invite'],
            inv['couple_nom'],
            inv['table_numero'],
            inv.get('role', 'invité'),
            inv.get('regime_alimentaire', 'Aucun'),
            inv.get('accompagnants', 0),
            inv['statut'],
            inv['date_scan'] or ''
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=invitations.csv"}
    )

@router.get("/stats")
def stats() -> Dict[str, Any]:
    """Retourne les statistiques des invitations."""
    donnees_stats = get_stats()
    return {
        "success": True,
        "data": donnees_stats,
        "message": "Statistiques récupérées avec succès."
    }

@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...)):
    """
    Importe une liste d'invités depuis un fichier CSV ou Excel.
    Génère les QR codes et les insère en base de données.
    """
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Format non supporté. Veuillez uploader un fichier .csv ou .xlsx")

    invites_ajoutes = 0
    erreurs = []

    try:
        content = await file.read()
        lignes = []
        
        if file.filename.endswith('.csv'):
            # Lecture du fichier CSV avec encodage robuste
            texte = content.decode('utf-8-sig')
            # Essayer d'abord la virgule
            reader = csv.DictReader(io.StringIO(texte), delimiter=',')
            if not reader.fieldnames or 'nom_invite' not in reader.fieldnames:
                # Si non trouvé, on tente le point-virgule (fréquent avec Excel français)
                reader = csv.DictReader(io.StringIO(texte), delimiter=';')
                
            for row in reader:
                lignes.append(row)
                
        elif file.filename.endswith('.xlsx'):
            # Lecture du fichier Excel via openpyxl
            wb = openpyxl.load_workbook(filename=io.BytesIO(content), data_only=True)
            sheet = wb.active
            headers = [str(cell.value) for cell in sheet[1]]
            
            for row in sheet.iter_rows(min_row=2, values_only=True):
                # Si la ligne est vide, on l'ignore
                if not any(row): 
                    continue
                row_dict = dict(zip(headers, row))
                lignes.append(row_dict)

        # Vérification de la présence des colonnes obligatoires
        colonnes_attendues = {'nom_invite', 'couple_nom', 'table_numero'}
        if not lignes:
            raise HTTPException(status_code=400, detail="Le fichier est vide ou illisible.")
            
        header_trouve = set(lignes[0].keys())
        if not colonnes_attendues.issubset(header_trouve):
            raise HTTPException(status_code=400, detail=f"Colonnes manquantes. Attendues : {colonnes_attendues}")

        # Traitement de chaque ligne du fichier
        for idx, row in enumerate(lignes, start=2): # start=2 pour coller au numéro de ligne réel
            nom = row.get('nom_invite')
            couple = row.get('couple_nom')
            table = row.get('table_numero')
            role = row.get('role', 'invité')
            regime = row.get('regime_alimentaire', 'Aucun')
            accomp = row.get('accompagnants', 0)
            
            # Exclusion des lignes incomplètes
            if not nom or not couple or not table:
                erreurs.append(f"Ligne {idx}: Données incomplètes.")
                continue
                
            # Appel de la logique de génération existante (Étape 3)
            try:
                req = GenerateQRRequest(
                    nom_invite=str(nom).strip(),
                    couple_nom=str(couple).strip(),
                    table_numero=str(table).strip(),
                    role=str(role).strip(),
                    regime_alimentaire=str(regime).strip(),
                    accompagnants=int(accomp) if str(accomp).isdigit() else 0
                )
                generate_qr(req)
                invites_ajoutes += 1
            except Exception as e:
                # Capture l'erreur spécifique à cette ligne sans bloquer l'import global
                erreurs.append(f"Ligne {idx} ({nom}): Erreur - {str(e)}")
                
    except Exception as e:
        logging.error(f"Erreur globale lors de l'import : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur inattendue de traitement du fichier: {str(e)}")

    return {
        "success": True,
        "data": {
            "importes": invites_ajoutes,
            "erreurs": erreurs
        },
        "message": f"Importation terminée. {invites_ajoutes} ajoutés, {len(erreurs)} erreur(s)."
    }



class ResetInviteRequest(BaseModel):
    code_qr: str

@router.post("/reset-invite")
async def reset_invite(request: ResetInviteRequest):
    """
    Remet un invité à son état initial (statut='attente', date_scan=NULL).
    Utile pour les tests répétés.
    """
    import database
    
    try:
        conn = database.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE invitations 
            SET statut = 'attente', date_scan = NULL 
            WHERE code_qr = ?
        ''', (request.code_qr,))
        
        conn.commit()
        conn.close()
        
        if cursor.rowcount > 0:
            logging.info(f"Invité {request.code_qr} réinitialisé à 'attente'")
            return {
                "success": True,
                "message": f"Invité {request.code_qr} réinitialisé"
            }
        else:
            return {
                "success": False,
                "message": f"Invité {request.code_qr} non trouvé"
            }
    except Exception as e:
        logging.error(f"Erreur lors de la réinitialisation de {request.code_qr}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
