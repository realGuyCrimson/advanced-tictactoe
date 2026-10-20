import { randomInt, randomUUID } from 'node:crypto';
import { GameEngine } from '../engine/GameEngine.js';
import { opponentOf, type Color, type Intent } from '../engine/types.js';
import {
  RECONNECT_GRACE_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_CODE_PATTERN,
  USERNAME_MAX_LENGTH,
  type PublicPlayer,
  type RoomClosedReason,
  type RoomErrorCode,
  type RoomPhase,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '../sockets/protocol.js';

/** Abstraction over Socket.IO so the manager can be unit-tested without a network. */
export interface RoomTransport {
  emit<E extends keyof ServerToClientEvents>(
    socketId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
}

export interface RoomManagerOptions {
  /** Reconnection grace period before a disconnected player forfeits the room. */
  graceMs?: number;
  /** Upper bound on concurrently open rooms. */
  maxRooms?: number;
  now?: () => number;
}

interface PlayerSlot {
  readonly token: string;
  username: string;
  color: Color;
  readonly isHost: boolean;
  socketId: string | null;
  wantsRematch: boolean;
  graceTimer: ReturnType<typeof setTimeout> | null;
  graceExpiresAt: number | null;
}

interface Room {
  readonly code: string;
  readonly players: PlayerSlot[];
  engine: GameEngine | null;
  round: number;
  readonly createdAt: number;
}

interface SocketBinding {
  readonly code: string;
  readonly token: string;
}

export function sanitizeUsername(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, USERNAME_MAX_LENGTH) || 'Player';
}

export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly bindings = new Map<string, SocketBinding>();
  private readonly graceMs: number;
  private readonly maxRooms: number;
  private readonly now: () => number;

  constructor(
    private readonly transport: RoomTransport,
    options: RoomManagerOptions = {},
  ) {
    this.graceMs = options.graceMs ?? RECONNECT_GRACE_MS;
    this.maxRooms = options.maxRooms ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  /** "Host Game": creates a room and seats the creator as Red. */
  createRoom(socketId: string, username: unknown): void {
    this.leaveCurrentRoom(socketId);
    if (this.rooms.size >= this.maxRooms) {
      this.error(socketId, 'INVALID_REQUEST', 'The server is at capacity. Please try again shortly.');
      return;
    }
    const code = this.generateCode();
    const host = this.createSlot(username, 'red', true);
    const room: Room = { code, players: [host], engine: null, round: 1, createdAt: this.now() };
    this.rooms.set(code, room);
    this.attach(room, host, socketId);
    this.transport.emit(socketId, 'ROOM_JOINED', { sessionToken: host.token, room: this.snapshot(room, host) });
  }

  /** "Join Game": seats the first joiner as Blue and starts round 1. */
  joinRoom(socketId: string, rawCode: unknown, username: unknown, sessionToken?: unknown): void {
    const code = normalizeRoomCode(rawCode);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) {
      this.error(socketId, 'ROOM_NOT_FOUND', 'That room does not exist or has already closed.');
      return;
    }

    const existing = typeof sessionToken === 'string' ? this.findSlot(room, sessionToken) : undefined;
    if (existing) {
      this.resume(room, existing, socketId);
      return;
    }

    const current = this.bindings.get(socketId);
    if (current?.code === room.code) {
      const slot = this.findSlot(room, current.token);
      if (slot) this.transport.emit(socketId, 'ROOM_JOINED', { sessionToken: slot.token, room: this.snapshot(room, slot) });
      return;
    }

    if (room.players.length >= 2) {
      this.error(socketId, 'ROOM_FULL', 'Room Full: this match already has two players.');
      return;
    }

    this.leaveCurrentRoom(socketId);
    const host = room.players[0];
    const joiner = this.createSlot(username, host ? opponentOf(host.color) : 'blue', false);
    room.players.push(joiner);
    room.engine = new GameEngine('red');
    this.attach(room, joiner, socketId);
    this.transport.emit(socketId, 'ROOM_JOINED', { sessionToken: joiner.token, room: this.snapshot(room, joiner) });
    this.broadcast(room, socketId);
  }

  /** Reclaims a seat after a refresh or dropped connection within the grace period. */
  rejoinRoom(socketId: string, rawCode: unknown, sessionToken: unknown): void {
    const code = normalizeRoomCode(rawCode);
    const room = code ? this.rooms.get(code) : undefined;
    const slot = room && typeof sessionToken === 'string' ? this.findSlot(room, sessionToken) : undefined;
    if (!room || !slot) {
      this.error(socketId, 'REJOIN_FAILED', 'Your previous match is no longer available.');
      return;
    }
    this.resume(room, slot, socketId);
  }

  handleIntent(socketId: string, intent: Intent): void {
    const ctx = this.context(socketId);
    if (!ctx) {
      this.transport.emit(socketId, 'MOVE_ERROR', { message: 'You are not in a room.' });
      return;
    }
    const { room, slot } = ctx;
    if (!room.engine || this.phase(room) !== 'playing') {
      this.transport.emit(socketId, 'MOVE_ERROR', { message: 'The match is not in progress.' });
      return;
    }
    const result = room.engine.apply(slot.color, intent);
    if (!result.ok) {
      this.transport.emit(socketId, 'MOVE_ERROR', { message: result.error });
      return;
    }
    this.broadcast(room);
  }

  /** Both players must opt in; colours swap and the new Red opens the next round. */
  setRematch(socketId: string, wants: boolean): void {
    const ctx = this.context(socketId);
    if (!ctx) return;
    const { room, slot } = ctx;
    if (this.phase(room) !== 'finished') {
      this.transport.emit(socketId, 'MOVE_ERROR', { message: 'A rematch is only available after the game ends.' });
      return;
    }
    slot.wantsRematch = wants;
    const ready = room.players.length === 2 && room.players.every((p) => p.wantsRematch && p.socketId !== null);
    if (ready) {
      for (const player of room.players) {
        player.color = opponentOf(player.color);
        player.wantsRematch = false;
      }
      room.round += 1;
      room.engine = new GameEngine('red');
    }
    this.broadcast(room);
  }

  /** Either player leaving tears the room down and returns both to the lobby. */
  leaveRoom(socketId: string): void {
    const ctx = this.context(socketId);
    if (!ctx) {
      this.bindings.delete(socketId);
      return;
    }
    this.closeRoom(ctx.room, 'left', `${ctx.slot.username} left the room.`, {
      socketId,
      message: 'You left the room.',
    });
  }

  handleDisconnect(socketId: string): void {
    const ctx = this.context(socketId);
    this.bindings.delete(socketId);
    if (!ctx || ctx.slot.socketId !== socketId) return;
    const { room, slot } = ctx;
    slot.socketId = null;
    slot.graceExpiresAt = this.now() + this.graceMs;
    slot.graceTimer = setTimeout(() => {
      slot.graceTimer = null;
      if (this.rooms.get(room.code) !== room) return;
      this.closeRoom(room, 'timeout', `${slot.username} disconnected and did not return in time.`);
    }, this.graceMs);
    slot.graceTimer.unref?.();
    this.broadcast(room);
  }

  /** Clears every timer; used on shutdown and in tests. */
  dispose(): void {
    for (const room of this.rooms.values()) this.clearTimers(room);
    this.rooms.clear();
    this.bindings.clear();
  }

  // ---------------------------------------------------------------------------

  private resume(room: Room, slot: PlayerSlot, socketId: string): void {
    const current = this.bindings.get(socketId);
    if (current && current.code !== room.code) this.leaveCurrentRoom(socketId);
    this.attach(room, slot, socketId);
    this.transport.emit(socketId, 'ROOM_JOINED', { sessionToken: slot.token, room: this.snapshot(room, slot) });
    this.broadcast(room, socketId);
  }

  private attach(room: Room, slot: PlayerSlot, socketId: string): void {
    if (slot.socketId && slot.socketId !== socketId) {
      // The same seat was opened elsewhere (e.g. a duplicated tab): the newest connection wins.
      this.bindings.delete(slot.socketId);
      this.transport.emit(slot.socketId, 'ROOM_CLOSED', {
        reason: 'replaced',
        message: 'This match was opened in another tab or window.',
      });
    }
    if (slot.graceTimer) clearTimeout(slot.graceTimer);
    slot.graceTimer = null;
    slot.graceExpiresAt = null;
    slot.socketId = socketId;
    this.bindings.set(socketId, { code: room.code, token: slot.token });
  }

  private leaveCurrentRoom(socketId: string): void {
    if (this.bindings.has(socketId)) this.leaveRoom(socketId);
  }

  private closeRoom(
    room: Room,
    reason: RoomClosedReason,
    message: string,
    initiator?: { socketId: string; message: string },
  ): void {
    this.clearTimers(room);
    this.rooms.delete(room.code);
    for (const player of room.players) {
      if (!player.socketId) continue;
      this.bindings.delete(player.socketId);
      const text = initiator?.socketId === player.socketId ? initiator.message : message;
      this.transport.emit(player.socketId, 'ROOM_CLOSED', { reason, message: text });
      player.socketId = null;
    }
  }

  private clearTimers(room: Room): void {
    for (const player of room.players) {
      if (player.graceTimer) clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
  }

  private context(socketId: string): { room: Room; slot: PlayerSlot } | null {
    const binding = this.bindings.get(socketId);
    if (!binding) return null;
    const room = this.rooms.get(binding.code);
    const slot = room ? this.findSlot(room, binding.token) : undefined;
    if (!room || !slot) return null;
    return { room, slot };
  }

  private findSlot(room: Room, token: string): PlayerSlot | undefined {
    return room.players.find((p) => p.token === token);
  }

  private createSlot(username: unknown, color: Color, isHost: boolean): PlayerSlot {
    return {
      token: randomUUID(),
      username: sanitizeUsername(username),
      color,
      isHost,
      socketId: null,
      wantsRematch: false,
      graceTimer: null,
      graceExpiresAt: null,
    };
  }

  private generateCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private phase(room: Room): RoomPhase {
    if (!room.engine) return 'waiting';
    return room.engine.state.status === 'playing' ? 'playing' : 'finished';
  }

  private snapshot(room: Room, viewer: PlayerSlot): RoomSnapshot {
    const players: PublicPlayer[] = room.players.map((p) => ({
      username: p.username,
      color: p.color,
      isHost: p.isHost,
      connected: p.socketId !== null,
      wantsRematch: p.wantsRematch,
      graceExpiresAt: p.graceExpiresAt,
    }));
    return {
      code: room.code,
      phase: this.phase(room),
      round: room.round,
      players,
      game: room.engine?.state ?? null,
      yourColor: viewer.color,
      serverTime: this.now(),
    };
  }

  private broadcast(room: Room, exceptSocketId?: string): void {
    for (const player of room.players) {
      if (!player.socketId || player.socketId === exceptSocketId) continue;
      this.transport.emit(player.socketId, 'GAME_STATE_UPDATE', this.snapshot(room, player));
    }
  }

  private error(socketId: string, code: RoomErrorCode, message: string): void {
    this.transport.emit(socketId, 'ROOM_ERROR', { code, message });
  }
}
