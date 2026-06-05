import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("Début des tests API locaux...")
    erreurs = 0

    # 1. Test Stats
    try:
        res = requests.get(f"{BASE_URL}/scan/stats")
        print(f"GET /scan/stats -> {res.status_code}")
        if res.status_code != 200: erreurs += 1
    except Exception as e:
        print(f"Erreur /scan/stats: {e}")
        erreurs += 1

    # 2. Test Login Admin
    try:
        res = requests.post(f"{BASE_URL}/admin/login", json={"password": "admin123"})
        print(f"POST /admin/login (success) -> {res.status_code}")
        if res.status_code != 200: erreurs += 1
        
        res_fail = requests.post(f"{BASE_URL}/admin/login", json={"password": "wrong"})
        print(f"POST /admin/login (fail) -> {res_fail.status_code}")
        if res_fail.status_code != 401: erreurs += 1
    except Exception as e:
        print(f"Erreur /admin/login: {e}")
        erreurs += 1

    # 3. Test Liste Invités
    try:
        res = requests.get(f"{BASE_URL}/invites")
        print(f"GET /invites -> {res.status_code}")
        if res.status_code != 200: erreurs += 1
        data = res.json()
        print(f"Nombre d'invités trouvés: {len(data.get('data', []))}")
    except Exception as e:
        print(f"Erreur /invites: {e}")
        erreurs += 1

    # 4. Test Ajouter Invité
    try:
        new_invite = {
            "nom_invite": "Test API",
            "couple_nom": "Test API Couple",
            "table_numero": "99"
        }
        res = requests.post(f"{BASE_URL}/invites", json=new_invite)
        print(f"POST /invites -> {res.status_code}")
        if res.status_code != 200: erreurs += 1
    except Exception as e:
        print(f"Erreur POST /invites: {e}")
        erreurs += 1

    # Bilan
    if erreurs == 0:
        print("[OK] TOUS LES TESTS API SONT PASSE AVEC SUCCES.")
        sys.exit(0)
    else:
        print(f"[ERREUR] {erreurs} ERREURS DETECTEES.")
        sys.exit(1)

if __name__ == "__main__":
    test_api()
