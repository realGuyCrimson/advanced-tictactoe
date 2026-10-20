// The engine and wire protocol live in the server package and are shared verbatim.
export type {
  AppliedMove,
  Board,
  CellStack,
  Color,
  GameState,
  Intent,
  Piece,
  Size,
} from '@shared/engine/types';
export type {
  PublicPlayer,
  RoomClosedPayload,
  RoomErrorPayload,
  RoomJoinedPayload,
  RoomPhase,
  RoomSnapshot,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@shared/sockets/protocol';

/** What the local player currently has "lifted". */
export type Selection = { kind: 'reserve'; pieceId: string } | { kind: 'board'; from: number };

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';
