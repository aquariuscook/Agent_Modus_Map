// Real-time collaboration via WebSocket
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyToken } from './auth-service.js';

interface WSClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  swarmId: string;
  cursor?: { x: number; y: number };
  color: string;
}

interface WSMessage {
  type: string;
  payload: any;
}

const COLORS = ['#00d9ff', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
let colorIndex = 0;

export class CollaborationServer {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, WSClient>();
  private swarmRooms = new Map<string, Set<WebSocket>>();

  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const swarmId = url.searchParams.get('swarmId') || 'default';

      // Auth is optional for dev mode
      let userId = 'anon-' + Math.random().toString(36).slice(2, 6);
      let userName = 'Anonymous';

      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          userId = decoded.userId;
          userName = decoded.role;
        }
      }

      const color = COLORS[colorIndex++ % COLORS.length];
      const client: WSClient = { ws, userId, userName, swarmId, color };
      this.clients.set(ws, client);

      // Join swarm room
      if (!this.swarmRooms.has(swarmId)) {
        this.swarmRooms.set(swarmId, new Set());
      }
      this.swarmRooms.get(swarmId)!.add(ws);

      // Send initial presence
      this.broadcastToRoom(swarmId, {
        type: 'presence.joined',
        payload: { userId, userName, color, users: this.getRoomUsers(swarmId) },
      }, ws);

      // Send current users to the new client
      ws.send(JSON.stringify({
        type: 'presence.init',
        payload: { userId, color, users: this.getRoomUsers(swarmId) },
      }));

      ws.on('message', (data) => {
        try {
          const msg: WSMessage = JSON.parse(data.toString());
          this.handleMessage(client, msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        const room = this.swarmRooms.get(swarmId);
        if (room) {
          room.delete(ws);
          if (room.size === 0) {
            this.swarmRooms.delete(swarmId);
          }
        }
        this.broadcastToRoom(swarmId, {
          type: 'presence.left',
          payload: { userId, users: this.getRoomUsers(swarmId) },
        });
      });
    });
  }

  private handleMessage(client: WSClient, msg: WSMessage): void {
    switch (msg.type) {
      case 'cursor.move':
        client.cursor = msg.payload;
        this.broadcastToRoom(client.swarmId, {
          type: 'cursor.update',
          payload: { userId: client.userId, userName: client.userName, color: client.color, ...msg.payload },
        }, client.ws);
        break;

      case 'agent.selected':
        this.broadcastToRoom(client.swarmId, {
          type: 'agent.selected',
          payload: { userId: client.userId, userName: client.userName, color: client.color, agentId: msg.payload.agentId },
        }, client.ws);
        break;

      case 'agent.moved':
        this.broadcastToRoom(client.swarmId, {
          type: 'agent.moved',
          payload: { userId: client.userId, agentId: msg.payload.agentId, position: msg.payload.position },
        }, client.ws);
        break;

      case 'swarm.changed':
        this.broadcastToRoom(client.swarmId, {
          type: 'swarm.changed',
          payload: { userId: client.userId, changeType: msg.payload.changeType },
        }, client.ws);
        break;

      case 'chat.message':
        this.broadcastToRoom(client.swarmId, {
          type: 'chat.message',
          payload: {
            userId: client.userId,
            userName: client.userName,
            color: client.color,
            message: msg.payload.message,
            timestamp: new Date().toISOString(),
          },
        });
        break;
    }
  }

  private broadcastToRoom(swarmId: string, msg: WSMessage, exclude?: WebSocket): void {
    const room = this.swarmRooms.get(swarmId);
    if (!room) return;

    const data = JSON.stringify(msg);
    for (const ws of room) {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private getRoomUsers(swarmId: string): Array<{ userId: string; userName: string; color: string }> {
    const room = this.swarmRooms.get(swarmId);
    if (!room) return [];

    return [...room]
      .map(ws => this.clients.get(ws))
      .filter(Boolean)
      .map(c => ({ userId: c!.userId, userName: c!.userName, color: c!.color }));
  }
}
