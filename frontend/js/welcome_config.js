/**
 * welcome_config.js
 * Configuration de l'écran de bienvenue
 * 
 * Pour personnaliser :
 * 1. Modifiez COUPLE_NAMES avec les noms des mariés
 * 2. Placez la photo du couple dans assets/images/couple.jpg
 * 3. Ajustez WELCOME_DURATION si besoin
 */

window.WELCOME_CONFIG = {
  // Noms du couple (affichés sur l'écran idle)
  COUPLE_NAMES: 'Sarah & Thomas',
  
  // Durée d'affichage du message de bienvenue (en millisecondes)
  WELCOME_DURATION: 8000, // 8 secondes
  
  // Chemin de l'image du couple
  COUPLE_IMAGE: '/assets/images/couple.jpg',
  
  // Nombre de particules en arrière-plan
  PARTICLE_COUNT: 50,
  
  // Nombre de confettis
  CONFETTI_COUNT: 150,
  
  // Messages personnalisés
  MESSAGES: {
    idle: 'Bienvenue à notre mariage',
    waiting: 'En attente d\'un invité...',
    welcome: 'Nous sommes ravis de vous accueillir'
  }
};
