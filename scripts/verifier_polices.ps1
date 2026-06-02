# Script de verification des polices
$ErrorActionPreference = "Continue"

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "  Verification des polices Google Fonts" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

$fontsDir = Join-Path $PSScriptRoot "..\frontend\assets\fonts"

# Verifier que le dossier existe
if (-not (Test-Path $fontsDir)) {
    Write-Host "ERROR: Le dossier fonts n'existe pas !" -ForegroundColor Red
    Write-Host "Chemin attendu: $fontsDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "Dossier fonts: " -NoNewline
Write-Host "OK" -ForegroundColor Green
Write-Host "Chemin: $fontsDir`n" -ForegroundColor Gray

# Liste des fichiers attendus
$expectedFiles = @(
    @{Name="playfair-display-v30-latin-700.woff2"; MinSize=20000},
    @{Name="playfair-display-v30-latin-700.woff"; MinSize=25000},
    @{Name="inter-v13-latin-regular.woff2"; MinSize=15000},
    @{Name="inter-v13-latin-regular.woff"; MinSize=20000},
    @{Name="inter-v13-latin-500.woff2"; MinSize=15000},
    @{Name="inter-v13-latin-500.woff"; MinSize=20000},
    @{Name="inter-v13-latin-600.woff2"; MinSize=15000},
    @{Name="inter-v13-latin-600.woff"; MinSize=20000}
)

$allPresent = $true
$presentCount = 0

Write-Host "Verification des fichiers:" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

foreach ($expected in $expectedFiles) {
    $filePath = Join-Path $fontsDir $expected.Name
    
    if (Test-Path $filePath) {
        $fileSize = (Get-Item $filePath).Length
        $fileSizeKB = [math]::Round($fileSize / 1024, 2)
        
        if ($fileSize -ge $expected.MinSize) {
            Write-Host "[OK]" -ForegroundColor Green -NoNewline
            Write-Host " $($expected.Name) " -NoNewline
            Write-Host "($fileSizeKB KB)" -ForegroundColor Gray
            $presentCount++
        } else {
            Write-Host "[!!]" -ForegroundColor Yellow -NoNewline
            Write-Host " $($expected.Name) " -NoNewline
            Write-Host "(trop petit: $fileSizeKB KB)" -ForegroundColor Yellow
            $allPresent = $false
        }
    } else {
        Write-Host "[--]" -ForegroundColor Red -NoNewline
        Write-Host " $($expected.Name) " -NoNewline
        Write-Host "(manquant)" -ForegroundColor Red
        $allPresent = $false
    }
}

Write-Host "`n----------------------------------------" -ForegroundColor Gray
Write-Host "Fichiers presents: $presentCount / $($expectedFiles.Count)" -ForegroundColor Cyan

if ($allPresent) {
    Write-Host "`n[SUCCESS]" -ForegroundColor Green -NoNewline
    Write-Host " Toutes les polices sont presentes !`n" -ForegroundColor White
    
    Write-Host "Prochaine etape:" -ForegroundColor Cyan
    Write-Host "  1. Dites 'Polices pretes' pour decommenter les @font-face" -ForegroundColor White
    Write-Host "  2. Relancez le serveur: python main.py" -ForegroundColor White
    Write-Host "  3. Ouvrez http://localhost:8000/ et verifiez les polices`n" -ForegroundColor White
    
} else {
    Write-Host "`n[ATTENTION]" -ForegroundColor Yellow -NoNewline
    Write-Host " Certains fichiers sont manquants ou invalides.`n" -ForegroundColor White
    
    Write-Host "Comment resoudre:" -ForegroundColor Cyan
    Write-Host "  1. Lisez le guide: .kiro\GUIDE_POLICES_MANUEL.md" -ForegroundColor White
    Write-Host "  2. Telechargez depuis: https://gwfh.mranftl.com" -ForegroundColor White
    Write-Host "  3. Placez les fichiers dans: $fontsDir" -ForegroundColor White
    Write-Host "  4. Relancez ce script pour verifier`n" -ForegroundColor White
}

Write-Host "================================================`n" -ForegroundColor Cyan
