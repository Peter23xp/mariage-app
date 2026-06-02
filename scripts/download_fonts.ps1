# Script PowerShell : Téléchargement automatique des polices Google Fonts
# Utilise l'API Google Fonts pour récupérer les fichiers woff2

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Téléchargement des polices Google Fonts" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$fontsDir = Join-Path $PSScriptRoot "..\frontend\assets\fonts"

# Créer le dossier si nécessaire
if (-not (Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null
}

# URLs de l'API Google Fonts
$playfairUrl = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"
$interUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"

Write-Host "[1/4] Téléchargement de Playfair Display 700..." -ForegroundColor Yellow

try {
    # Récupérer le CSS qui contient les URLs des fichiers woff2
    $playfairCss = Invoke-WebRequest -Uri $playfairUrl -UseBasicParsing -UserAgent "Mozilla/5.0"
    
    # Extraire les URLs des fichiers woff2 depuis le CSS
    $woff2Urls = [regex]::Matches($playfairCss.Content, "url\((https://[^)]+\.woff2)\)") | ForEach-Object { $_.Groups[1].Value }
    
    $counter = 1
    foreach ($url in $woff2Urls) {
        $filename = "playfair-display-v30-latin-700.woff2"
        $destination = Join-Path $fontsDir $filename
        
        Write-Host "  → Téléchargement : $filename" -ForegroundColor Gray
        Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing
        Write-Host "  ✓ OK : $filename" -ForegroundColor Green
        
        $counter++
    }
    
} catch {
    Write-Host "  ✗ Erreur : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[2/4] Téléchargement de Inter 400, 500, 600..." -ForegroundColor Yellow

try {
    $interCss = Invoke-WebRequest -Uri $interUrl -UseBasicParsing -UserAgent "Mozilla/5.0"
    
    # Extraire toutes les URLs woff2
    $woff2Urls = [regex]::Matches($interCss.Content, "url\((https://[^)]+\.woff2)\)") | ForEach-Object { $_.Groups[1].Value }
    
    $weights = @("regular", "500", "600")
    $counter = 0
    
    foreach ($url in $woff2Urls) {
        if ($counter -lt $weights.Length) {
            $weight = $weights[$counter]
            $filename = "inter-v13-latin-$weight.woff2"
            $destination = Join-Path $fontsDir $filename
            
            Write-Host "  → Téléchargement : $filename" -ForegroundColor Gray
            Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing
            Write-Host "  ✓ OK : $filename" -ForegroundColor Green
            
            $counter++
        }
    }
    
} catch {
    Write-Host "  ✗ Erreur : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[3/4] Vérification des fichiers téléchargés..." -ForegroundColor Yellow

$expectedFiles = @(
    "playfair-display-v30-latin-700.woff2",
    "inter-v13-latin-regular.woff2",
    "inter-v13-latin-500.woff2",
    "inter-v13-latin-600.woff2"
)

$allPresent = $true
foreach ($file in $expectedFiles) {
    $path = Join-Path $fontsDir $file
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Write-Host "  ✓ $file ($size octets)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (manquant)" -ForegroundColor Red
        $allPresent = $false
    }
}

Write-Host ""
Write-Host "[4/4] Résumé" -ForegroundColor Yellow

if ($allPresent) {
    Write-Host "  ✓ Tous les fichiers woff2 ont été téléchargés avec succès !" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Emplacement : $fontsDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Prochaine étape :" -ForegroundColor Cyan
    Write-Host "  → Décommenter les @font-face dans frontend/css/main.css" -ForegroundColor White
} else {
    Write-Host "  ⚠ Certains fichiers sont manquants." -ForegroundColor Yellow
    Write-Host "  → Téléchargez-les manuellement depuis google-webfonts-helper" -ForegroundColor White
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
