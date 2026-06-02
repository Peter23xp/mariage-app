import time
import logging
from scanner import CameraScanner

# Configuration basique des logs pour voir ce qu'il se passe
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

def test_camera():
    print("=== Démarrage du Test CameraScanner ===")
    
    # 1. Instanciation et Démarrage
    scanner = CameraScanner(camera_index=0)
    scanner.start()
    
    # On attend un tout petit peu pour laisser le thread ouvrir la caméra
    time.sleep(1)
    
    # 2. Vérification pendant 10 secondes
    print(f"\n[Test] Statut camera_available au démarrage : {scanner.camera_available}")
    
    if scanner.camera_available:
        print("[Test] La caméra est active. Le test va tourner pendant 10 secondes...")
        for i in range(1, 11):
            time.sleep(1)
            # On vérifie si on arrive à récupérer une frame (sans l'afficher, juste la taille)
            frame_bytes = scanner.get_frame()
            print(f"[Test] Seconde {i}/10 - frame de {len(frame_bytes)} octets récupérée.")
    else:
        print("[Test] La caméra n'a pas pu s'ouvrir. Vérifiez vos branchements.")
        time.sleep(2)  # Petite pause pour voir le log d'erreur
        
    # 3. Arrêt propre
    print("\n=== Arrêt du Test ===")
    scanner.stop()
    print("[Test] Terminé proprement.")

if __name__ == "__main__":
    test_camera()
