# Script simplifie pour telecharger les polices
$ErrorActionPreference = "Stop"

Write-Host "Telechargement des polices Google Fonts..." -ForegroundColor Cyan

$fontsDir = Join-Path $PSScriptRoot "..\frontend\assets\fonts"
New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null

# URLs directes vers les fichiers woff2 (GitHub mirror de Google Fonts)
$urls = @{
    "playfair-display-v30-latin-700.woff2" = "https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf"
    "inter-v13-latin-regular.woff2" = "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf"
}

Write-Host "Note: Les fichiers TTF seront telecharges." -ForegroundColor Yellow
Write-Host "Vous devrez les convertir en woff2 avec un outil en ligne." -ForegroundColor Yellow
Write-Host ""
Write-Host "Alternative recommandee:" -ForegroundColor Green
Write-Host "1. Allez sur https://gwfh.mranftl.com" -ForegroundColor White
Write-Host "2. Cherchez 'Playfair Display' et telechargez le poids 700" -ForegroundColor White
Write-Host "3. Cherchez 'Inter' et telechargez les poids 400, 500, 600" -ForegroundColor White
Write-Host "4. Placez les fichiers woff2 dans: $fontsDir" -ForegroundColor White
Write-Host ""
Write-Host "Appuyez sur une touche une fois termine..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
