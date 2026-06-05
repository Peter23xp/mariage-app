@echo off
:: Script de demarrage pour l'application Mariage
:: Supprime les warnings OpenCV et ouvre automatiquement le navigateur

echo ========================================
echo  Application Mariage - Demarrage
echo ========================================
echo.

:: Configuration des variables d'environnement pour reduire les warnings
set OPENCV_VIDEOIO_PRIORITY_MSMF=0
set OPENCV_LOG_LEVEL=ERROR
set PYTHONWARNINGS=ignore

:: Demarrage de l'application avec Python 3.11
echo Demarrage de l'application...
echo L'ecran de bienvenue s'ouvrira automatiquement dans votre navigateur...
echo.
py -3.11 main.py

:: Pause en cas d'erreur
if errorlevel 1 (
    echo.
    echo Une erreur s'est produite lors du demarrage.
    pause
)
