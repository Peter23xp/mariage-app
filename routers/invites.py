"""
Routeur FastAPI pour la gestion des invités existants.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
import database

# Optionnel: on utilise aussi le générateur QR pour la création
from routers.generator import generate_qr, GenerateQRRequest

router = APIRouter(tags=["Invités"])

class InviteCreate(BaseModel):
    nom_invite: str
    couple_nom: str
    table_numero: str

class InviteUpdate(BaseModel):
    nom_invite: str
    couple_nom: str
    table_numero: str

@router.get("/invites")
def liste_invites(search: Optional[str] = "") -> Dict[str, Any]:
    """Retourne la liste de tous les invités enregistrés (filtrable)."""
    invites = database.get_tous_invites(search=search)
    return {
        "success": True,
        "data": invites,
        "message": "Liste récupérée avec succès."
    }

@router.post("/invites")
def creer_invite(invite: InviteCreate) -> Dict[str, Any]:
    """Ajoute un nouvel invité (génère son QR code en même temps)."""
    try:
        # On passe par le générateur qui gère l'insertion et l'image PNG
        req = GenerateQRRequest(
            nom_invite=invite.nom_invite,
            couple_nom=invite.couple_nom,
            table_numero=invite.table_numero
        )
        res = generate_qr(req)
        return {"success": True, "data": res, "message": "Invité créé avec succès."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/invites/{id_invite}")
def modifier_invite(id_invite: int, invite: InviteUpdate) -> Dict[str, Any]:
    """Modifie les informations d'un invité."""
    succes = database.update_invite(id_invite, invite.nom_invite, invite.couple_nom, invite.table_numero)
    if succes:
        return {"success": True, "message": "Invité mis à jour."}
    raise HTTPException(status_code=404, detail="Invité non trouvé ou aucune modification.")

@router.delete("/invites/{id_invite}")
def supprimer_invite(id_invite: int) -> Dict[str, Any]:
    """Supprime un invité."""
    succes = database.supprimer_invite_by_id(id_invite)
    if succes:
        return {"success": True, "message": "Invité supprimé."}
    raise HTTPException(status_code=404, detail="Invité non trouvé.")
