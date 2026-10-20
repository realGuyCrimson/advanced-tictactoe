/**
 * Wire protocol shared by the server and the client. Type-only module: it is
 * safe to import from the browser bundle.
 */
import type { Color, GameState } from '../engine/types.js';

export type RoomPhase = 'waiting' | 'playing' | 'finished';

export interface PublicPlayer {
  readonly username: string;
  readonly color: Color;
  readonly isHost: boolean;
  readonly connected: boolean;
  readonly wantsRematch: boolean;
  /** Epoch ms when this player's reconnection grace period expires, if disconnected. */
  readonly graceExpiresAt: number | null;
}

export interface RoomSnapshot {
  readonly code: string;
  readonly phase: RoomPhase;
  /** Increments on every rematch (round 1 is the first game). */
  readonly round: number;
  readonly players: readonly PublicPlayer[];
  /** `null` while waiting for the second player. */
  readonly game: GameState | null;
  /** The colour of the client receiving this snapshot. */
  readonly yourColor: Color;
  readonly serverTime: number;
}

export type RoomErrorCode =
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'REJOIN_FAILED'
  | 'INVALID_REQUEST'
  | 'ALREADY_IN_ROOM';

export interface RoomErrorPayload {
  readonly code: RoomErrorCode;
  readonly message: string;
}

export type RoomClosedReason = 'left' | 'timeout' | 'replaced';

export interface RoomClosedPayload {
  readonly reason: RoomClosedReason;
  readonly message: string;
}

export interface RoomJoinedPayload {
  readonly sessionToken: string;
  readonly room: RoomSnapshot;
}

export interface ServerToClientEvents {
  ROOM_JOINED: (payload: RoomJoinedPayload) => void;
  GAME_STATE_UPDATE: (room: RoomSnapshot) => void;
  MOVE_ERROR: (payload: { message: string }) => void;
  ROOM_ERROR: (payload: RoomErrorPayload) => void;
  ROOM_CLOSED: (payload: RoomClosedPayload) => void;
}

export interface ClientToServerEvents {
  CREATE_ROOM: (payload: { username: string }) => void;
  JOIN_ROOM: (payload: { code: string; username: string; sessionToken?: string }) => void;
  REJOIN_ROOM: (payload: { code: string; sessionToken: string }) => void;
  PLACE_PIECE: (payload: { pieceId: string; to: number }) => void;
  MOVE_PIECE: (payload: { from: number; to: number }) => void;
  SET_REMATCH: (payload: { wants: boolean }) => void;
  LEAVE_ROOM: () => void;
}

/** Room codes avoid ambiguous characters such as 0/O and 1/I. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
export const RECONNECT_GRACE_MS = 20_000;
export const USERNAME_MAX_LENGTH = 16;
