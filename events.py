"""
Système de gestion des événements SSE (Server-Sent Events).
Permet la communication asynchrone entre le thread caméra (synchrone)
et les clients Web (navigateurs) via FastAPI (asynchrone).
"""

import asyncio
import logging
from datetime import datetime, timezone
import json

logger = logging.getLogger("events")

class EventBroadcaster:
    """
    Gère une liste de queues asyncio (une par client connecté).
    Expose la méthode 'broadcast' appelable de n'importe quel thread.
    """
    def __init__(self, max_clients: int = 50):
        self.queues = set()
        self.max_clients = max_clients
        self.loop = None
        
    def set_loop(self, loop: asyncio.AbstractEventLoop):
        """Définit la boucle d'événements asyncio principale au démarrage."""
        self.loop = loop
        logger.info("EventBroadcaster: Loop asynchrone configurée.")

    async def subscribe(self) -> asyncio.Queue:
        """
        Crée une nouvelle queue pour un nouveau client SSE.
        Limite le nombre de connexions simultanées pour éviter les fuites de mémoire.
        """
        if len(self.queues) >= self.max_clients:
            logger.warning("Limite de clients SSE atteinte.")
        
        # Queue limitée pour éviter l'accumulation infinie si le client est lent
        q = asyncio.Queue(maxsize=10)
        self.queues.add(q)
        logger.info(f"Client SSE connecté. Total: {len(self.queues)}")
        return q

    async def unsubscribe(self, queue: asyncio.Queue):
        """Nettoie la queue quand le client se déconnecte."""
        if queue in self.queues:
            self.queues.remove(queue)
            logger.info(f"Client SSE déconnecté. Total: {len(self.queues)}")

    def broadcast(self, event_type: str, data: dict):
        """
        Envoie un événement à tous les clients connectés.
        ⚠️ SYNCHRONE: Doit être appelé depuis un thread séparé (ex: thread caméra).
        Pour les coroutines async (endpoints FastAPI), utilisez broadcast_async().
        """
        if self.loop is None:
            logger.warning("Broadcaster: Appel à broadcast() avant set_loop(). Ignoré.")
            return

        event = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data
        }
        
        # Délègue l'exécution de la publication à la boucle principale (thread-safe)
        self.loop.call_soon_threadsafe(self._publish_to_queues, event)

    async def broadcast_async(self, event_type: str, data: dict):
        """
        Version async de broadcast() — à utiliser depuis les endpoints FastAPI (async def).
        Pousse directement l'événement dans les queues SSE sans passer par call_soon_threadsafe.
        """
        logger.info(f"broadcast_async() appelé: type={event_type}, clients connectés={len(self.queues)}")
        event = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data
        }
        json_event = json.dumps(event)
        dead_queues = set()
        sent_count = 0
        for q in self.queues:
            try:
                q.put_nowait(json_event)
                sent_count += 1
            except asyncio.QueueFull:
                logger.warning("Queue client pleine, événement SSE droppé.")
            except Exception as e:
                logger.error(f"Erreur envoi SSE à une queue: {e}")
                dead_queues.add(q)
        # Nettoyer les queues mortes
        if dead_queues:
            self.queues -= dead_queues
            logger.info(f"Queues mortes nettoyées: {len(dead_queues)}")
        logger.info(f"broadcast_async() terminé: événement envoyé à {sent_count}/{len(self.queues) + len(dead_queues)} clients")

    def _publish_to_queues(self, event: dict):
        """Exécuté dans la boucle asyncio depuis un thread séparé: pousse l'event dans chaque queue."""
        json_event = json.dumps(event)
        for q in self.queues:
            try:
                # put_nowait pour ne jamais bloquer le serveur si un client est bloqué
                q.put_nowait(json_event)
            except asyncio.QueueFull:
                logger.warning("Queue client pleine, événement SSE droppé.")

# Instance globale
broadcaster = EventBroadcaster()
