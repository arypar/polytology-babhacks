import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { log, logDebug } from './log.js';

interface ClientState {
  alive: boolean;
}

const clients = new Map<WebSocket, ClientState>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const state: ClientState = { alive: true };
    clients.set(ws, state);
    logDebug('ws', `Client connected (${clients.size} total)`);

    ws.send(JSON.stringify({ type: 'connected' }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('pong', () => { state.alive = true; });

    ws.on('close', () => {
      clients.delete(ws);
      logDebug('ws', `Client disconnected (${clients.size} total)`);
    });
  });

  const heartbeat = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  log('ws', 'WebSocket server ready on /ws');
}

export function broadcastToAll(event: Record<string, unknown>) {
  const msg = JSON.stringify(event);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}
