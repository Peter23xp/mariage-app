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
    role: Optional[str] = "Invité"
    regime_alimentaire: Optional[str] = "Aucun"
    accompagnants: Optional[int] = 0

class InviteUpdate(BaseModel):
    nom_invite: str
    couple_nom: str
    table_numero: str
    role: Optional[str] = "Invité"
    regime_alimentaire: Optional[str] = "Aucun"
    accompagnants: Optional[int] = 0

class TableUpdate(BaseModel):
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
        # On passe directement les kwargs supplémentaires à generate_qr via database ? 
        # Wait, generate_qr n'accepte pas role, etc. Il faut le rajouter dans database directement ou update generate_qr.
        # Pour éviter de modifier GenerateQRRequest, on laisse comme ça et on update après.
        res = generate_qr(req)
        # Mise à jour avec les champs additionnels
        database.update_invite(res['id'], invite.nom_invite, invite.couple_nom, invite.table_numero, invite.role, invite.regime_alimentaire, invite.accompagnants)
        
        return {"success": True, "data": res, "message": "Invité créé avec succès."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/invites/{id_invite}")
def modifier_invite(id_invite: int, invite: InviteUpdate) -> Dict[str, Any]:
    """Modifie les informations d'un invité."""
    succes = database.update_invite(
        id_invite, 
        invite.nom_invite, 
        invite.couple_nom, 
        invite.table_numero,
        invite.role,
        invite.regime_alimentaire,
        invite.accompagnants
    )
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

@router.patch("/invites/{id_invite}/table")
def modifier_table(id_invite: int, payload: TableUpdate) -> Dict[str, Any]:
    """Met à jour uniquement la table d'un invité (pour le drag & drop)."""
    succes = database.update_invite_table_only(id_invite, payload.table_numero)
    if succes:
        return {"success": True, "message": "Table mise à jour."}
    raise HTTPException(status_code=404, detail="Invité introuvable.")
