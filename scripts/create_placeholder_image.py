#!/usr/bin/env python3
"""
Script pour créer une image placeholder pour le couple
si aucune image n'est fournie.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_placeholder_couple_image():
    """Créer une image placeholder élégante pour le couple."""
    
    # Taille de l'image (carré pour l'affichage circulaire)
    width, height = 800, 800
    
    # Créer l'image avec un dégradé
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    
    # Créer un dégradé élégant
    for y in range(height):
        # Dégradé de bleu foncé à bleu clair
        r = int(15 + (100 - 15) * (y / height))
        g = int(23 + (150 - 23) * (y / height))
        b = int(42 + (200 - 42) * (y / height))
        draw.rectangle([(0, y), (width, y+1)], fill=(r, g, b))
    
    # Dessiner un cercle au centre
    circle_radius = 200
    center = (width // 2, height // 2)
    
    # Cercle extérieur (bordure)
    draw.ellipse(
        [center[0] - circle_radius - 10, center[1] - circle_radius - 10,
         center[0] + circle_radius + 10, center[1] + circle_radius + 10],
        fill=(255, 255, 255, 50),
        outline=(255, 255, 255)
    )
    
    # Dessiner des anneaux (symbole de mariage)
    ring_radius = 80
    ring_width = 15
    ring_offset = 60
    
    # Premier anneau (gauche)
    for i in range(ring_width):
        draw.ellipse(
            [center[0] - ring_offset - ring_radius + i,
             center[1] - 30 - ring_radius + i,
             center[0] - ring_offset + ring_radius - i,
             center[1] - 30 + ring_radius - i],
            outline=(255, 215, 0)  # Or
        )
    
    # Deuxième anneau (droite, qui s'entrelace)
    for i in range(ring_width):
        draw.ellipse(
            [center[0] + ring_offset - ring_radius + i,
             center[1] - 30 - ring_radius + i,
             center[0] + ring_offset + ring_radius - i,
             center[1] - 30 + ring_radius - i],
            outline=(192, 192, 192)  # Argent
        )
    
    # Ajouter du texte
    try:
        # Essayer d'utiliser une police système
        font_large = ImageFont.truetype("arial.ttf", 60)
        font_small = ImageFont.truetype("arial.ttf", 30)
    except:
        # Fallback sur la police par défaut
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Texte principal
    text = "Photo du Couple"
    text_bbox = draw.textbbox((0, 0), text, font=font_large)
    text_width = text_bbox[2] - text_bbox[0]
    text_x = (width - text_width) // 2
    text_y = center[1] + 150
    
    # Ombre du texte
    draw.text((text_x + 2, text_y + 2), text, fill=(0, 0, 0, 128), font=font_large)
    # Texte principal
    draw.text((text_x, text_y), text, fill=(255, 255, 255), font=font_large)
    
    # Sous-texte
    subtext = "Placez votre photo ici"
    subtext_bbox = draw.textbbox((0, 0), subtext, font=font_small)
    subtext_width = subtext_bbox[2] - subtext_bbox[0]
    subtext_x = (width - subtext_width) // 2
    subtext_y = text_y + 80
    
    draw.text((subtext_x, subtext_y), subtext, fill=(200, 200, 200), font=font_small)
    
    # Sauvegarder l'image
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, 'couple.jpg')
    img.save(output_path, 'JPEG', quality=95)
    
    print(f"✓ Image placeholder créée : {output_path}")
    print(f"  Dimensions : {width}x{height}px")
    print(f"  Remplacez ce fichier par votre vraie photo du couple !")

if __name__ == '__main__':
    create_placeholder_couple_image()
