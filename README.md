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

### Accès à l'Application

**URL Principale (Écran de Bienvenue) :**
- `https://localhost:8888/` ou `https://192.168.x.x:8888/`
- **Page par défaut** - Affiche l'écran de bienvenue avec animations
- À afficher en plein écran sur écran secondaire/projecteur

**Interface de Scan :**
- `https://localhost:8888/scan.html` ou `https://192.168.x.x:8888/scan.html`
- Scanner les QR codes des invités

**Panneau d'Administration :**
- `https://localhost:8888/admin.html` ou `https://192.168.x.x:8888/admin.html`
- Gérer les invités (login requis : `admin123` ou `3Nathalie?`)

**Page de Login :**
- `https://localhost:8888/login.html`

### Fonctionnalités Principales

#### Interface Admin
- ✅ Gestion CRUD des invités
- ✅ Import/Export CSV
- ✅ Filtres avancés (statut, table, recherche)
- ✅ Sélection multiple et actions en masse
- ✅ Génération de QR codes et invitations PDF
- ✅ Statistiques en temps réel
- ✅ Interface responsive sans émojis

#### Écran de Bienvenue Secondaire (NOUVEAU)
- ✅ Affichage élégant sur écran secondaire/projecteur
- ✅ Photo des mariés avec animations de particules
- ✅ Messages de bienvenue personnalisés en temps réel
- ✅ Animation de confettis colorés
- ✅ Badge de numéro de table
- ✅ Complètement configurable (noms, durée, couleurs)

**📖 Voir [.kiro/WELCOME_DISPLAY.md](.kiro/WELCOME_DISPLAY.md) pour la configuration complète de l'écran de bienvenue.**

## Structure du Projet
- `main.py` : Point d'entrée de l'application et serveur FastAPI.
- `database.py` : Gestion de la base de données SQLite.
- `scanner.py` : Logique de la webcam et décodage QR (via OpenCV et pyzbar).
- `frontend/` : Fichiers statiques (HTML/CSS/JS) pour l'interface utilisateur sans framework.
- `routers/` : Routes API séparées par fonctionnalités (scan, invitations, admin, génération).
- `outputs/` : Dossiers où sont générés les QR codes et invitations PDF.
- `assets/` : Sons de bienvenue/alerte et images.
