import type { Server, Socket } from 'socket.io';
import { RoomManager, type RoomTransport } from '../rooms/RoomManager.js';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol.js';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

export function createSocketTransport(io: GameServer): RoomTransport {
  return {
    emit(socketId, event, ...args) {
      // Socket.IO's typed emit cannot follow the generic event key, so widen locally.
      (io.to(socketId).emit as (ev: string, ...a: unknown[]) => boolean)(event, ...args);
    },
  };
}

/** Wires every client intent to the room manager with defensive payload checks. */
export function registerSocketHandlers(io: GameServer, rooms: RoomManager): void {
  io.on('connection', (socket: GameSocket) => {
    const invalid = () =>
      socket.emit('ROOM_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed request.' });

    socket.on('CREATE_ROOM', (payload) => {
      rooms.createRoom(socket.id, isRecord(payload) ? payload.username : undefined);
    });

    socket.on('JOIN_ROOM', (payload) => {
      if (!isRecord(payload)) return invalid();
      rooms.joinRoom(socket.id, payload.code, payload.username, payload.sessionToken);
    });

    socket.on('REJOIN_ROOM', (payload) => {
      if (!isRecord(payload)) return invalid();
      rooms.rejoinRoom(socket.id, payload.code, payload.sessionToken);
    });

    socket.on('PLACE_PIECE', (payload) => {
      if (!isRecord(payload) || typeof payload.pieceId !== 'string' || !isInt(payload.to)) {
        socket.emit('MOVE_ERROR', { message: 'Malformed move.' });
        return;
      }
      rooms.handleIntent(socket.id, { type: 'PLACE_PIECE', pieceId: payload.pieceId, to: payload.to });
    });

    socket.on('MOVE_PIECE', (payload) => {
      if (!isRecord(payload) || !isInt(payload.from) || !isInt(payload.to)) {
        socket.emit('MOVE_ERROR', { message: 'Malformed move.' });
        return;
      }
      rooms.handleIntent(socket.id, { type: 'MOVE_PIECE', from: payload.from, to: payload.to });
    });

    socket.on('SET_REMATCH', (payload) => {
      rooms.setRematch(socket.id, isRecord(payload) ? payload.wants === true : false);
    });

    socket.on('LEAVE_ROOM', () => rooms.leaveRoom(socket.id));

    socket.on('disconnect', () => rooms.handleDisconnect(socket.id));
  });
}
