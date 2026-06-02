"""
Module de gestion de la base de données SQLite.
Contient l'initialisation des tables et toutes les opérations CRUD.
"""

import sqlite3
import logging
import re
import time
import threading
from typing import List, Dict, Any, Optional
from datetime import datetime
from config import DB_RETRY_COUNT, DB_RETRY_DELAY_MS

# Configuration globale des logs pour écrire dans mariage_log.txt
logging.basicConfig(
    filename='mariage_log.txt',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

DB_PATH = "mariage.db"

# Lock global pour assurer l'atomicité des transactions SELECT + UPDATE
db_lock = threading.Lock()

def get_connection() -> sqlite3.Connection:
    """Retourne une connexion à la base de données SQLite."""
    conn = sqlite3.connect(DB_PATH)
    # Permet d'accéder aux colonnes comme à des dictionnaires
    conn.row_factory = sqlite3.Row  
    return conn

def init_db() -> None:
    """Initialise la base de données SQLite et crée les tables au premier lancement."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Activation du mode WAL pour améliorer la concurrence
            cursor.execute("PRAGMA journal_mode=WAL;")
            wal_mode = cursor.fetchone()[0]
            logging.info(f"Mode WAL activé : {wal_mode}")
            
            # Vérification du mode synchronous
            cursor.execute("PRAGMA synchronous=NORMAL;")
            
            # Table des invitations
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS invitations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code_qr TEXT UNIQUE NOT NULL,
                    nom_invite TEXT NOT NULL,
                    couple_nom TEXT NOT NULL,
                    table_numero TEXT NOT NULL,
                    statut TEXT DEFAULT 'attente',
                    date_scan DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Table de configuration (clé/valeur)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS config (
                    cle TEXT PRIMARY KEY,
                    valeur TEXT NOT NULL
                )
            ''')
            
            conn.commit()
            logging.info("Base de données initialisée avec succès.")
    except Exception as e:
        logging.error(f"Erreur lors de l'initialisation de la base de données: {e}")
        raise

def set_config(cle: str, valeur: str) -> bool:
    """Définit ou met à jour une valeur de configuration dans la table config."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO config (cle, valeur) VALUES (?, ?)
                ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur
            ''', (cle, valeur))
            conn.commit()
            return True
    except Exception as e:
        logging.error(f"Erreur lors de la définition de la configuration {cle}: {e}")
        return False

def get_config(cle: str) -> Optional[str]:
    """Récupère une valeur de configuration. Retourne None si inexistante."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT valeur FROM config WHERE cle = ?', (cle,))
            row = cursor.fetchone()
            return row['valeur'] if row else None
    except Exception as e:
        logging.error(f"Erreur lors de la récupération de la configuration {cle}: {e}")
        return None

def ajouter_invite(code_qr: str, nom_invite: str, couple_nom: str, table_numero: str) -> bool:
    """Ajoute un nouvel invité dans la base de données."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO invitations (code_qr, nom_invite, couple_nom, table_numero)
                VALUES (?, ?, ?, ?)
            ''', (code_qr, nom_invite, couple_nom, table_numero))
            conn.commit()
            logging.info(f"Invité ajouté : {nom_invite} (QR: {code_qr})")
            return True
    except sqlite3.IntegrityError:
        logging.warning(f"Erreur d'intégrité : Le code QR {code_qr} existe déjà.")
        return False
    except Exception as e:
        logging.error(f"Erreur lors de l'ajout de l'invité {nom_invite}: {e}")
        return False

def get_invite_by_qr(code_qr: str) -> Optional[Dict[str, Any]]:
    """Récupère les informations d'un invité via son code QR."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM invitations WHERE code_qr = ?', (code_qr,))
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logging.error(f"Erreur lors de la récupération du QR {code_qr}: {e}")
        return None

def marquer_entre(code_qr: str) -> bool:
    """Marque un invité comme 'entré' et enregistre l'heure du scan."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute('''
                UPDATE invitations 
                SET statut = 'entré', date_scan = ? 
                WHERE code_qr = ?
            ''', (now, code_qr))
            conn.commit()
            if cursor.rowcount > 0:
                logging.info(f"Scan validé : Invité avec QR {code_qr} est entré.")
                return True
            return False
    except Exception as e:
        logging.error(f"Erreur lors de la mise à jour du statut pour {code_qr}: {e}")
        return False

def get_tous_invites(search: str = "") -> List[Dict[str, Any]]:
    """Récupère la liste des invités, filtrée par recherche, triée par date d'ajout."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            if search:
                # Recherche par nom ou QR
                query = '''
                    SELECT * FROM invitations 
                    WHERE nom_invite LIKE ? OR code_qr LIKE ?
                    ORDER BY created_at DESC
                '''
                like_term = f"%{search}%"
                cursor.execute(query, (like_term, like_term))
            else:
                cursor.execute('SELECT * FROM invitations ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logging.error(f"Erreur lors de la récupération de tous les invités: {e}")
        return []

def get_stats() -> Dict[str, int]:
    """Calcule et retourne les statistiques globales des invités."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total FROM invitations")
            total = cursor.fetchone()['total']
            
            cursor.execute("SELECT COUNT(*) as entres FROM invitations WHERE statut = 'entré'")
            entres = cursor.fetchone()['entres']
            
            attente = total - entres
            return {
                "total": total,
                "entres": entres,
                "attente": attente
            }
    except Exception as e:
        logging.error(f"Erreur lors de la récupération des statistiques: {e}")
        return {"total": 0, "entres": 0, "attente": 0}

def supprimer_invite(code_qr: str) -> bool:
    """Supprime un invité de la base de données via son code QR."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM invitations WHERE code_qr = ?', (code_qr,))
            conn.commit()
            if cursor.rowcount > 0:
                logging.info(f"Invité supprimé (QR: {code_qr})")
                return True
            return False
    except Exception as e:
        logging.error(f"Erreur lors de la suppression de l'invité {code_qr}: {e}")
        return False

def supprimer_invite_by_id(id_invite: int) -> bool:
    """Supprime un invité via son ID (Admin)."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM invitations WHERE id = ?', (id_invite,))
            conn.commit()
            return cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Erreur lors de la suppression de l'invité ID {id_invite}: {e}")
        return False

def update_invite(id_invite: int, nom_invite: str, couple_nom: str, table_numero: str) -> bool:
    """Met à jour les informations d'un invité (sauf le QR Code)."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE invitations 
                SET nom_invite = ?, couple_nom = ?, table_numero = ?
                WHERE id = ?
            ''', (nom_invite, couple_nom, table_numero, id_invite))
            conn.commit()
            return cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Erreur lors de la mise à jour de l'invité ID {id_invite}: {e}")
        return False

def valider_scan(code_qr: str) -> dict:
    """
    Valide un code QR scanné et met à jour le statut de l'invité si nécessaire.
    
    Cette fonction est thread-safe et gère les 3 cas métier :
    - VALIDE : Code QR existe et statut='attente' → UPDATE statut='entré' + date_scan
    - DÉJÀ UTILISÉ : Code QR existe et statut='entré' → Lecture seule, retour infos
    - INVALIDE : Code QR malformé ou introuvable dans la BDD
    
    Args:
        code_qr: Le code QR scanné (format attendu: MAR2026-XXXX)
    
    Returns:
        dict: Dictionnaire avec les clés suivantes:
            - statut: "valide" | "deja_utilise" | "invalide"
            - code_qr: Le code QR scanné
            - nom_invite: Nom de l'invité (None si invalide)
            - couple_nom: Nom du couple (None si invalide)
            - table_numero: Numéro de table (None si invalide)
            - date_scan: Date du scan au format ISO-8601 (None si invalide ou premier scan)
            - message: Message descriptif du résultat
    
    Examples:
        >>> valider_scan("MAR2026-0001")
        {
            "statut": "valide",
            "code_qr": "MAR2026-0001",
            "nom_invite": "Jean Dupont",
            "couple_nom": "Dupont-Martin",
            "table_numero": "1",
            "date_scan": "2026-06-14T18:42:13",
            "message": "Bienvenue Jean Dupont !"
        }
        
        >>> valider_scan("MAR2026-0001")  # Second scan
        {
            "statut": "deja_utilise",
            "code_qr": "MAR2026-0001",
            "nom_invite": "Jean Dupont",
            "couple_nom": "Dupont-Martin",
            "table_numero": "1",
            "date_scan": "2026-06-14T18:42:13",
            "message": "Code QR déjà utilisé le 14/06/2026 à 18:42:13"
        }
        
        >>> valider_scan("MAR2026-9999")
        {
            "statut": "invalide",
            "code_qr": "MAR2026-9999",
            "nom_invite": None,
            "couple_nom": None,
            "table_numero": None,
            "date_scan": None,
            "message": "Code QR invalide ou non trouvé"
        }
    """
    # 1. Validation regex du format
    if not re.match(r'^MAR2026-[A-Z0-9]+$', code_qr):
        logging.warning(f"SCAN INVALIDE - {code_qr} (format incorrect)")
        return {
            "statut": "invalide",
            "code_qr": code_qr,
            "nom_invite": None,
            "couple_nom": None,
            "table_numero": None,
            "date_scan": None,
            "message": "Format de code QR invalide"
        }
    
    # 2. Retry avec backoff en cas de DB locked
    for attempt in range(DB_RETRY_COUNT):
        try:
            with db_lock:
                conn = get_connection()
                try:
                    cursor = conn.cursor()
                    
                    # 3. Transaction atomique avec BEGIN IMMEDIATE
                    cursor.execute("BEGIN IMMEDIATE")
                    
                    # 4. SELECT pour récupérer les infos
                    cursor.execute('SELECT * FROM invitations WHERE code_qr = ?', (code_qr,))
                    row = cursor.fetchone()
                    
                    # 5. Si aucun résultat → invalide
                    if not row:
                        conn.rollback()
                        logging.warning(f"SCAN INVALIDE - {code_qr} (code introuvable)")
                        return {
                            "statut": "invalide",
                            "code_qr": code_qr,
                            "nom_invite": None,
                            "couple_nom": None,
                            "table_numero": None,
                            "date_scan": None,
                            "message": "Code QR invalide ou non trouvé"
                        }
                    
                    invite = dict(row)
                    
                    # 6. Si statut = 'entré' → déjà utilisé
                    if invite['statut'] == 'entré':
                        conn.rollback()
                        date_scan_str = invite['date_scan']
                        date_obj = datetime.fromisoformat(date_scan_str) if date_scan_str else None
                        date_formatted = date_obj.strftime("%d/%m/%Y à %H:%M:%S") if date_obj else "inconnue"
                        
                        logging.info(f"SCAN DÉJÀ UTILISÉ - {code_qr} - Premier scan: {date_formatted}")
                        return {
                            "statut": "deja_utilise",
                            "code_qr": code_qr,
                            "nom_invite": invite['nom_invite'],
                            "couple_nom": invite['couple_nom'],
                            "table_numero": invite['table_numero'],
                            "date_scan": date_scan_str,
                            "message": f"Code QR déjà utilisé le {date_formatted}"
                        }
                    
                    # 7. Sinon → UPDATE statut='entré' + date_scan
                    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    cursor.execute('''
                        UPDATE invitations 
                        SET statut = 'entré', date_scan = ? 
                        WHERE code_qr = ?
                    ''', (now, code_qr))
                    
                    # 8. COMMIT
                    conn.commit()
                    
                    logging.info(f"SCAN VALIDE - {code_qr} - {invite['nom_invite']} (Table {invite['table_numero']})")
                    return {
                        "statut": "valide",
                        "code_qr": code_qr,
                        "nom_invite": invite['nom_invite'],
                        "couple_nom": invite['couple_nom'],
                        "table_numero": invite['table_numero'],
                        "date_scan": now,
                        "message": f"Bienvenue {invite['nom_invite']} !"
                    }
                    
                finally:
                    conn.close()
                    
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < DB_RETRY_COUNT - 1:
                # Retry avec backoff
                time.sleep(DB_RETRY_DELAY_MS / 1000.0)
                logging.warning(f"Database locked, retry {attempt + 1}/{DB_RETRY_COUNT}")
                continue
            else:
                logging.error(f"Erreur OperationalError après {attempt + 1} tentatives: {e}")
                return {
                    "statut": "invalide",
                    "code_qr": code_qr,
                    "nom_invite": None,
                    "couple_nom": None,
                    "table_numero": None,
                    "date_scan": None,
                    "message": "Erreur de base de données"
                }
        except Exception as e:
            logging.error(f"Erreur lors de la validation du scan {code_qr}: {e}")
            return {
                "statut": "invalide",
                "code_qr": code_qr,
                "nom_invite": None,
                "couple_nom": None,
                "table_numero": None,
                "date_scan": None,
                "message": "Erreur système"
            }
    
    # Si toutes les tentatives échouent
    return {
        "statut": "invalide",
        "code_qr": code_qr,
        "nom_invite": None,
        "couple_nom": None,
        "table_numero": None,
        "date_scan": None,
        "message": "Base de données temporairement indisponible"
    }

def get_scan_info(code_qr: str) -> Optional[dict]:
    """
    Récupère les informations d'un scan sans modifier l'état.
    
    Fonction de lecture seule qui retourne les mêmes informations que valider_scan()
    mais sans effectuer de modification en base. Utile pour le frontend pour afficher
    les informations d'un invité sans changer son statut.
    
    Args:
        code_qr: Le code QR à consulter
    
    Returns:
        dict | None: Dictionnaire avec les infos de l'invité, ou None si introuvable
    
    Example:
        >>> get_scan_info("MAR2026-0001")
        {
            "statut": "entré",
            "code_qr": "MAR2026-0001",
            "nom_invite": "Jean Dupont",
            "couple_nom": "Dupont-Martin",
            "table_numero": "1",
            "date_scan": "2026-06-14T18:42:13",
            "message": "Informations de l'invité"
        }
    """
    try:
        # Lecture seule, pas de Lock nécessaire avec WAL mode
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM invitations WHERE code_qr = ?', (code_qr,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            invite = dict(row)
            return {
                "statut": invite['statut'],
                "code_qr": invite['code_qr'],
                "nom_invite": invite['nom_invite'],
                "couple_nom": invite['couple_nom'],
                "table_numero": invite['table_numero'],
                "date_scan": invite['date_scan'],
                "message": "Informations de l'invité"
            }
    except Exception as e:
        logging.error(f"Erreur lors de la récupération des infos du scan {code_qr}: {e}")
        return None
