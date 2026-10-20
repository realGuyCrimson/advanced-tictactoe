import { createGameServer, parseOrigins } from './app.js';

const port = Number(process.env.PORT) || 3001;
const graceMs = process.env.RECONNECT_GRACE_MS ? Number(process.env.RECONNECT_GRACE_MS) : undefined;

const server = createGameServer({
  allowedOrigins: parseOrigins(process.env.CLIENT_ORIGINS),
  graceMs,
});

server.httpServer.listen(port, () => {
  console.log(`[tttadv] game server listening on http://localhost:${port}`);
});

const shutdown = (signal: string) => {
  console.log(`[tttadv] ${signal} received, shutting down`);
  void server.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
