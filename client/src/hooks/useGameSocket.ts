import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '../lib/config';
import { clearSession, loadSession, saveSession } from '../lib/storage';
import type {
  ClientToServerEvents,
  ConnectionStatus,
  RoomErrorPayload,
  RoomSnapshot,
  ServerToClientEvents,
} from '../types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Notice {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

export interface GameSocketApi {
  status: ConnectionStatus;
  room: RoomSnapshot | null;
  /** Server clock minus local clock, for countdowns. */
  clockOffset: number;
  /** A create/join request is in flight. */
  pending: boolean;
  /** Re-claiming a seat from sessionStorage after a refresh. */
  resuming: boolean;
  lobbyError: RoomErrorPayload | null;
  notice: Notice | null;
  /** Bumped whenever the server rejects a move. */
  moveError: Notice | null;
  hostGame: (username: string) => void;
  joinGame: (code: string, username: string) => void;
  placePiece: (pieceId: string, to: number) => void;
  movePiece: (from: number, to: number) => void;
  setRematch: (wants: boolean) => void;
  leaveRoom: () => void;
  dismissNotice: () => void;
  clearLobbyError: () => void;
}

let noticeId = 0;
const makeNotice = (message: string, tone: Notice['tone'] = 'info'): Notice => ({ id: ++noticeId, message, tone });

export function useGameSocket(): GameSocketApi {
  const socketRef = useRef<GameSocket | null>(null);
  const leavingRef = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [pending, setPending] = useState(false);
  const [resuming, setResuming] = useState(() => loadSession() !== null);
  const [lobbyError, setLobbyError] = useState<RoomErrorPayload | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [moveError, setMoveError] = useState<Notice | null>(null);

  useEffect(() => {
    const socket: GameSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
      timeout: 15_000,
    });
    socketRef.current = socket;

    const applyRoom = (next: RoomSnapshot) => {
      setClockOffset(next.serverTime - Date.now());
      setRoom(next);
    };

    socket.on('connect', () => {
      setStatus('connected');
      const session = loadSession();
      if (session) {
        setResuming(true);
        socket.emit('REJOIN_ROOM', { code: session.code, sessionToken: session.sessionToken });
      }
    });

    socket.on('disconnect', (reason) => {
      // "io client disconnect" only happens on unmount.
      if (reason !== 'io client disconnect') setStatus('reconnecting');
    });

    socket.on('connect_error', () => {
      setStatus((prev) => (prev === 'connected' || prev === 'reconnecting' ? 'reconnecting' : 'offline'));
      setPending(false);
    });

    socket.on('ROOM_JOINED', ({ sessionToken, room: snapshot }) => {
      saveSession({ code: snapshot.code, sessionToken });
      leavingRef.current = false;
      setPending(false);
      setResuming(false);
      setLobbyError(null);
      applyRoom(snapshot);
    });

    socket.on('GAME_STATE_UPDATE', applyRoom);

    socket.on('MOVE_ERROR', ({ message }) => setMoveError(makeNotice(message, 'error')));

    socket.on('ROOM_ERROR', (error) => {
      setPending(false);
      if (error.code === 'REJOIN_FAILED') {
        clearSession();
        setResuming(false);
        setRoom(null);
        setNotice(makeNotice(error.message, 'error'));
        return;
      }
      setLobbyError(error);
    });

    socket.on('ROOM_CLOSED', ({ message }) => {
      clearSession();
      setRoom(null);
      setPending(false);
      if (!leavingRef.current) setNotice(makeNotice(message));
      leavingRef.current = false;
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback(<E extends keyof ClientToServerEvents>(event: E, ...args: Parameters<ClientToServerEvents[E]>) => {
    const socket = socketRef.current;
    if (!socket) return false;
    (socket.emit as (ev: string, ...a: unknown[]) => void)(event, ...args);
    return true;
  }, []);

  const hostGame = useCallback(
    (username: string) => {
      setLobbyError(null);
      setPending(true);
      emit('CREATE_ROOM', { username });
    },
    [emit],
  );

  const joinGame = useCallback(
    (code: string, username: string) => {
      setLobbyError(null);
      setPending(true);
      const session = loadSession();
      emit('JOIN_ROOM', {
        code,
        username,
        sessionToken: session?.code === code ? session.sessionToken : undefined,
      });
    },
    [emit],
  );

  const placePiece = useCallback((pieceId: string, to: number) => void emit('PLACE_PIECE', { pieceId, to }), [emit]);
  const movePiece = useCallback((from: number, to: number) => void emit('MOVE_PIECE', { from, to }), [emit]);
  const setRematch = useCallback((wants: boolean) => void emit('SET_REMATCH', { wants }), [emit]);

  const leaveRoom = useCallback(() => {
    leavingRef.current = true;
    emit('LEAVE_ROOM');
    // Return to the lobby immediately; the server tears the room down for both players.
    clearSession();
    setRoom(null);
  }, [emit]);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const clearLobbyError = useCallback(() => setLobbyError(null), []);

  return {
    status,
    room,
    clockOffset,
    pending,
    resuming: resuming && status !== 'offline',
    lobbyError,
    notice,
    moveError,
    hostGame,
    joinGame,
    placePiece,
    movePiece,
    setRematch,
    leaveRoom,
    dismissNotice,
    clearLobbyError,
  };
}
