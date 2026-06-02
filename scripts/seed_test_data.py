"""
Script de génération de données de test pour le système de scan.
Crée 5 invités de test avec leurs QR codes associés.

Usage:
    python scripts/seed_test_data.py

Caractéristiques:
- Idempotent : si les invités existent déjà, ne les recrée pas
- Génère automatiquement les images QR dans outputs/qrcodes/
- Affiche un récapitulatif dans la console
"""

import sys
import os
import sqlite3
import qrcode
from pathlib import Path

# Ajouter le répertoire parent au path pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import database

# Données de test prédéfinies
TEST_INVITES = [
    {
        "code_qr": "MAR2026-0001",
        "nom_invite": "Jean Dupont",
        "couple_nom": "Dupont-Martin",
        "table_numero": "1"
    },
    {
        "code_qr": "MAR2026-0002",
        "nom_invite": "Marie Martin",
        "couple_nom": "Dupont-Martin",
        "table_numero": "1"
    },
    {
        "code_qr": "MAR2026-0003",
        "nom_invite": "Paul Bernard",
        "couple_nom": "Bernard-Leroy",
        "table_numero": "2"
    },
    {
        "code_qr": "MAR2026-0004",
        "nom_invite": "Sophie Leroy",
        "couple_nom": "Bernard-Leroy",
        "table_numero": "3"
    },
    {
        "code_qr": "MAR2026-0005",
        "nom_invite": "Lucas Petit",
        "couple_nom": "Petit-Dubois",
        "table_numero": "3"
    }
]

QR_DIR = Path("outputs/qrcodes")
QR_DIR.mkdir(parents=True, exist_ok=True)


def generer_qr_image(code_qr: str, filepath: Path) -> bool:
    """Génère une image QR code et la sauvegarde."""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(code_qr)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(filepath)
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la génération du QR {code_qr}: {e}")
        return False


def main():
    """Fonction principale de seeding."""
    print("=" * 60)
    print("🌱 SEEDING DES DONNÉES DE TEST")
    print("=" * 60)
    print()
    
    # Initialiser la base de données si nécessaire
    database.init_db()
    
    compteurs = {
        "crees": 0,
        "existants": 0,
        "qr_generes": 0,
        "qr_existants": 0
    }
    
    for invite in TEST_INVITES:
        code_qr = invite["code_qr"]
        nom = invite["nom_invite"]
        
        # 1. Ajout en base de données (idempotent)
        existe_deja = database.get_invite_by_qr(code_qr) is not None
        
        if existe_deja:
            print(f"⏭️  {code_qr} - {nom} : déjà en base")
            compteurs["existants"] += 1
        else:
            success = database.ajouter_invite(
                code_qr=code_qr,
                nom_invite=invite["nom_invite"],
                couple_nom=invite["couple_nom"],
                table_numero=invite["table_numero"]
            )
            if success:
                print(f"✅ {code_qr} - {nom} : ajouté en base")
                compteurs["crees"] += 1
            else:
                print(f"❌ {code_qr} - {nom} : erreur lors de l'ajout")
                continue
        
        # 2. Génération du QR code image
        qr_filepath = QR_DIR / f"{code_qr}.png"
        
        if qr_filepath.exists():
            print(f"   📄 Image QR déjà existante : {qr_filepath}")
            compteurs["qr_existants"] += 1
        else:
            if generer_qr_image(code_qr, qr_filepath):
                print(f"   📄 Image QR générée : {qr_filepath}")
                compteurs["qr_generes"] += 1
        
        print()
    
    # Récapitulatif
    print("=" * 60)
    print("📊 RÉCAPITULATIF")
    print("=" * 60)
    print(f"Invités créés       : {compteurs['crees']}")
    print(f"Invités existants   : {compteurs['existants']}")
    print(f"QR générés          : {compteurs['qr_generes']}")
    print(f"QR déjà existants   : {compteurs['qr_existants']}")
    print()
    print("✨ Seeding terminé avec succès !")
    print()
    print("📁 Fichiers QR disponibles dans : outputs/qrcodes/")
    print("🗄️  Base de données : mariage.db")
    print()


if __name__ == "__main__":
    main()
