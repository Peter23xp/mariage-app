"""
generate_ssl_cert.py
Génère un certificat SSL auto-signé pour le serveur local.
Requis pour l'accès caméra iPhone (HTTPS obligatoire pour getUserMedia).

Usage : python generate_ssl_cert.py
Résultat : ssl/cert.pem + ssl/key.pem
"""

import os
import ipaddress
import datetime
import socket
import sys

# Force UTF-8 output on Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
except ImportError:
    print("❌ Module 'cryptography' manquant.")
    print("   Installez-le avec : pip install cryptography")
    raise SystemExit(1)


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def generate_cert(cert_path="ssl/cert.pem", key_path="ssl/key.pem"):
    os.makedirs("ssl", exist_ok=True)

    local_ip = get_local_ip()
    print(f"[INFO] IP locale detectee : {local_ip}")

    # 1. Générer la clé privée RSA 2048 bits
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # 2. Construire le certificat auto-signé
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BE"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Mariage App Local"),
        x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(
            datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=825)
        )
        # SAN : l'iPhone vérifie le SubjectAltName, pas le CN
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                x509.IPAddress(ipaddress.IPv4Address(local_ip)),
            ]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=None),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )

    # 3. Écrire les fichiers PEM
    with open(key_path, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print(f"[OK] Cle privee    : {key_path}")
    print(f"[OK] Certificat    : {cert_path}")
    print()
    print("-" * 60)
    print("  ETAPES SUIVANTES :")
    print("-" * 60)
    print(f"  1. Arretez le serveur actuel (Ctrl+C dans le terminal)")
    print(f"  2. Redemarrez : py -3.11 main.py")
    print(f"  3. Sur iPhone (Safari), ouvrez :")
    print(f"     https://{local_ip}:8888/scan-mobile")
    print(f"  4. Safari : 'Connexion non privee' -> Afficher details")
    print(f"           -> Consulter ce site web -> OK")
    print(f"  5. La camera s'active automatiquement !")
    print("-" * 60)


if __name__ == "__main__":
    generate_cert()
