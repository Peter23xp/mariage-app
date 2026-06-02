# Application de Gestion d'Invitations de Mariage

Application desktop de gestion d'invitations fonctionnant 100% hors ligne, avec scan de QR codes, génération d'invitations PDF et panneau d'administration.

## Prérequis
- Python 3.10 ou supérieur
- Webcam (pour le scan des QR codes)

## Installation

1. Cloner ou télécharger ce dépôt.
2. Installer les dépendances avec `pip` :

```bash
pip install -r requirements.txt
```

*(Note sur Windows : Il peut être nécessaire d'installer les bibliothèques C++ redistribuables pour OpenCV et pyzbar si elles ne sont pas déjà présentes sur le système).*

## Lancement

Démarrer le serveur local FastAPI :

```bash
python main.py
```

L'application ouvrira les services sur le port local `8000`.

## Utilisation

- **Interface de Scan** : Ouvrir `http://localhost:8000/` pour lancer la caméra et scanner les QR codes.
- **Panneau d'Administration** : Ouvrir `http://localhost:8000/admin.html` pour gérer les invités, ajouter des personnes manuellement, ou importer une liste depuis un fichier CSV/Excel.

## Structure du Projet
- `main.py` : Point d'entrée de l'application et serveur FastAPI.
- `database.py` : Gestion de la base de données SQLite.
- `scanner.py` : Logique de la webcam et décodage QR (via OpenCV et pyzbar).
- `frontend/` : Fichiers statiques (HTML/CSS/JS) pour l'interface utilisateur sans framework.
- `routers/` : Routes API séparées par fonctionnalités (scan, invitations, admin, génération).
- `outputs/` : Dossiers où sont générés les QR codes et invitations PDF.
- `assets/` : Sons de bienvenue/alerte et images.
