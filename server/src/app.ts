import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { createSocketTransport, registerSocketHandlers, type GameServer } from './sockets/registerSocketHandlers.js';

export interface GameServerOptions {
  /** Origins allowed to open a Socket.IO connection (cross-origin deployments such as Netlify). */
  allowedOrigins?: (string | RegExp)[];
  graceMs?: number;
  /** Directory with the built client to serve as a single-page app, if present. */
  clientDist?: string | null;
}

export interface GameServerInstance {
  httpServer: HttpServer;
  io: GameServer;
  rooms: RoomManager;
  close: () => Promise<void>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CLIENT_DIST = path.resolve(here, '../../client/dist');

export const DEFAULT_ALLOWED_ORIGINS: (string | RegExp)[] = [
  'https://tttadv.netlify.app',
  // Netlify deploy previews and branch deploys: https://<id>--tttadv.netlify.app
  /^https:\/\/[a-z0-9-]+--tttadv\.netlify\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export function parseOrigins(value: string | undefined): (string | RegExp)[] {
  if (!value) return DEFAULT_ALLOWED_ORIGINS;
  if (value.trim() === '*') return [/.*/];
  const custom = value
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...custom];
}

export function createGameServer(options: GameServerOptions = {}): GameServerInstance {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.roomCount, uptime: Math.round(process.uptime()) });
  });

  const clientDist = options.clientDist === undefined ? DEFAULT_CLIENT_DIST : options.clientDist;
  if (clientDist && existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    // SPA fallback so /<ROOMCODE> deep links load the client.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('Advanced Tic-Tac-Toe game server is running.');
    });
  }

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });

  const rooms = new RoomManager(createSocketTransport(io), { graceMs: options.graceMs });
  registerSocketHandlers(io, rooms);

  return {
    httpServer,
    io,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        rooms.dispose();
        io.close(() => resolve());
      }),
  };
}
