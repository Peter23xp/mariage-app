"""
Module scanner.py
Gère la capture de la webcam en arrière-plan et le décodage des codes QR.
"""

import cv2
import threading
import time
import logging

# Import de la configuration depuis config.py
from config import CAMERA_INDEX, FPS_TARGET, ANTI_DOUBLE_SCAN_DELAY, JPEG_QUALITY
from events import broadcaster
from PIL import Image, ImageDraw
import io
import database

logger = logging.getLogger("scanner")

def generate_offline_frame() -> bytes:
    """Génère une image d'erreur statique en mémoire avec Pillow."""
    img = Image.new('RGB', (640, 480), color=(15, 15, 26)) # Fond #0F0F1A
    draw = ImageDraw.Draw(img)
    text = "CAMERA HORS LIGNE"
    # Centrage rudimentaire sans police externe (approx)
    draw.text((260, 230), text, fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=JPEG_QUALITY)
    return buf.getvalue()

OFFLINE_FRAME = generate_offline_frame()

class ScanStats:
    """Compteurs thread-safe pour les statistiques du scanner."""
    def __init__(self):
        self._lock = threading.Lock()
        self.scans_total = 0
        self.scans_valides = 0
        self.scans_invalides = 0
        self.scans_doubles = 0
        
    def increment_valide(self):
        with self._lock:
            self.scans_total += 1
            self.scans_valides += 1
            
    def increment_double(self):
        with self._lock:
            self.scans_total += 1
            self.scans_doubles += 1
    
    def increment_invalide(self):
        with self._lock:
            self.scans_total += 1
            self.scans_invalides += 1

    def reset(self):
        with self._lock:
            self.scans_total = 0
            self.scans_valides = 0
            self.scans_invalides = 0
            self.scans_doubles = 0
            
    def get_dict(self):
        with self._lock:
            return {
                "scans_total": self.scans_total,
                "scans_valides": self.scans_valides,
                "scans_invalides": self.scans_invalides,
                "scans_doubles": self.scans_doubles
            }

class CameraScanner:
    """
    Classe gérant l'acquisition vidéo dans un thread dédié,
    le décodage de QR Codes avec pyzbar, et l'anti-double-scan.
    """
    
    def __init__(self, camera_index: int = CAMERA_INDEX):
        self.camera_index = camera_index
        self.cap = None
        self.is_running = False
        self.camera_available = False
        self.last_frame_time = 0
        self.stats = ScanStats()
        
        # Buffer pour la dernière image encodée en JPEG
        self.latest_frame = None
        self.frame_lock = threading.Lock()
        
        # Cache anti-double-scan: { "qr_data_string": timestamp_last_scan }
        self.last_scans = {}
        
        # Thread de capture
        self.capture_thread = None

    def start(self) -> None:
        """Démarre le thread de capture vidéo."""
        logger.info(f"Tentative d'ouverture de la caméra {self.camera_index}...")
        self.cap = cv2.VideoCapture(self.camera_index)
        
        if not self.cap.isOpened():
            logger.error(f"Impossible d'ouvrir la caméra à l'index {self.camera_index}")
            self.camera_available = False
            broadcaster.broadcast("camera_status", {"available": False})
            return
            
        self.camera_available = True
        broadcaster.broadcast("camera_status", {"available": True})
        self.is_running = True
        self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.capture_thread.start()
        logger.info("Thread caméra démarré avec succès.")

    def stop(self) -> None:
        """Stoppe proprement le flux vidéo."""
        self.is_running = False
        if self.capture_thread and self.capture_thread.is_alive():
            # Attend au maximum 2 secondes la fin du thread
            self.capture_thread.join(timeout=2.0)
            
        if self.cap:
            self.cap.release()
            self.cap = None
            
        broadcaster.broadcast("camera_status", {"available": False})
        logger.info("Caméra libérée.")

    def get_frame(self) -> bytes:
        """
        Renvoie la dernière frame encodée en JPEG.
        Si caméra indisponible ou frame vide, renvoie None.
        """
        if not self.camera_available:
            return None
            
        with self.frame_lock:
            if self.latest_frame is not None:
                return self.latest_frame
        
        return None

    def _capture_loop(self) -> None:
        """Boucle principale du thread (acquisition, décodage, encodage)."""
        while self.is_running:
            ret, frame = self.cap.read()
            if not ret:
                logger.warning("Erreur de lecture frame. Tentative de reconnexion dans 5s...")
                time.sleep(5)
                # Tentative de réouverture simplifiée :
                self.cap = cv2.VideoCapture(self.camera_index)
                continue
                
            # 1. Décodage du QR Code
            self._decode_qr(frame)
            
            # 2. Encodage JPEG pour le flux vidéo web
            ret_encode, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
            if ret_encode:
                with self.frame_lock:
                    self.latest_frame = buffer.tobytes()
                    self.last_frame_time = time.time()
                    
            # 3. Contrôle des FPS pour ne pas saturer le CPU
            time.sleep(1.0 / FPS_TARGET)

    def _decode_qr(self, frame) -> None:
        """
        Détecte les QR codes dans la frame avec OpenCV et applique l'anti-double-scan.
        """
        try:
            # Création du détecteur OpenCV
            detector = cv2.QRCodeDetector()
            retval, decoded_info, points, _ = detector.detectAndDecodeMulti(frame)
            
            if retval and decoded_info:
                for i, qr_data in enumerate(decoded_info):
                    if not qr_data:  # Ignore les détections vides (bruit)
                        continue
                        
                    # Feedback visuel direct sur la frame (dessiner un polygone autour)
                    if points is not None and len(points) > i:
                        pts = points[i].astype(int)
                        for j in range(4):
                            cv2.line(frame, tuple(pts[j]), tuple(pts[(j+1)%4]), (0, 255, 0), 2)
                    
                    now = time.time()
                    last_time = self.last_scans.get(qr_data, 0)
                    
                    # Anti-double-scan strict
                    if now - last_time > ANTI_DOUBLE_SCAN_DELAY:
                        self.last_scans[qr_data] = now
                        self._on_qr_detected(qr_data)
                    else:
                        # Logique double scan : ce n'est pas un vrai double scan BDD,
                        # juste un re-scan trop rapide du même QR (< 2s)
                        # Les stats de double scan BDD seront gérées par _on_qr_detected()
                        pass
                        
        except Exception as e:
            logger.error(f"Erreur lors du décodage QR : {e}")

    def reset_scanner(self) -> None:
        """Vide le cache anti-double-scan et réinitialise les stats."""
        self.last_scans.clear()
        self.stats.reset()
        logger.info("Scanner réinitialisé (cache et stats vidés).")

    def _on_qr_detected(self, qr_data: str) -> None:
        """
        Gère la détection d'un QR code et publie un événement SSE.
        Appelle database.valider_scan() pour la validation réelle.
        Robuste : ne crash jamais le thread caméra même en cas d'erreur BDD.
        """
        logger.info(f"[QR DÉTECTÉ] : {qr_data}")
        
        try:
            # Appel à la validation BDD réelle
            resultat = database.valider_scan(qr_data)
            
            # Mise à jour des stats selon le statut
            if resultat["statut"] == "valide":
                self.stats.increment_valide()
            elif resultat["statut"] == "deja_utilise":
                self.stats.increment_double()
            elif resultat["statut"] == "invalide":
                self.stats.increment_invalide()
            
            # Broadcast du résultat via SSE
            broadcaster.broadcast("scan_result", resultat)
            
        except Exception as e:
            # Robustesse critique : ne jamais crasher le thread caméra
            logger.error(f"Erreur critique lors de la validation du scan {qr_data}: {e}")
            # Broadcast un événement d'erreur générique
            broadcaster.broadcast("scan_result", {
                "statut": "invalide",
                "code_qr": qr_data,
                "nom_invite": None,
                "couple_nom": None,
                "table_numero": None,
                "date_scan": None,
                "message": "Erreur système lors de la validation"
            })

# Instance globale unique du scanner (pour éviter les imports circulaires)
scanner = CameraScanner()
