import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GameScreen } from './components/GameScreen';
import { RoomLobby } from './components/RoomLobby';
import { Toast } from './components/Toast';
import { WaitingRoom } from './components/WaitingRoom';
import { useGameSocket, type Notice } from './hooks/useGameSocket';
import { ALL_ASSETS } from './lib/assets';
import { roomCodeFromPath } from './lib/config';
import { loadUsername, saveUsername } from './lib/storage';

/** Decoded images are kept alive here so move animations never hit the network. */
const preloaded: HTMLImageElement[] = [];

export default function App() {
  const api = useGameSocket();
  const [username, setUsername] = useState(loadUsername);
  const [inviteCode, setInviteCode] = useState(() => roomCodeFromPath(window.location.pathname));
  const [moveToast, setMoveToast] = useState<Notice | null>(null);
  const wasInRoom = useRef(false);

  // Instant asset caching: warm every sprite on first mount.
  useEffect(() => {
    if (preloaded.length) return;
    for (const src of ALL_ASSETS) {
      const img = new Image();
      img.src = src;
      preloaded.push(img);
    }
  }, []);

  const roomCode = api.room?.code ?? null;

  // Keep the address bar on /<ROOMCODE> while in a room so it can be shared or refreshed.
  useEffect(() => {
    if (roomCode) {
      wasInRoom.current = true;
      if (window.location.pathname !== `/${roomCode}`) window.history.replaceState(null, '', `/${roomCode}`);
      setInviteCode(null);
    } else if (wasInRoom.current) {
      wasInRoom.current = false;
      window.history.replaceState(null, '', '/');
    }
  }, [roomCode]);

  useEffect(() => {
    const onPop = () => setInviteCode(roomCodeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (api.moveError) setMoveToast(api.moveError);
  }, [api.moveError]);

  useEffect(() => {
    document.title = roomCode ? `Room ${roomCode} · Advanced Tic-Tac-Toe` : 'Advanced Tic-Tac-Toe';
  }, [roomCode]);

  const changeUsername = useCallback((name: string) => {
    setUsername(name);
    saveUsername(name.trim());
  }, []);

  const dismissInvite = useCallback(() => {
    setInviteCode(null);
    window.history.replaceState(null, '', '/');
  }, []);

  let view;
  if (api.room) {
    view =
      api.room.phase === 'waiting' ? (
        <WaitingRoom room={api.room} onLeave={api.leaveRoom} />
      ) : (
        <GameScreen
          key={api.room.code}
          room={api.room}
          connection={api.status}
          clockOffset={api.clockOffset}
          moveError={api.moveError}
          onPlace={api.placePiece}
          onMove={api.movePiece}
          onRematch={api.setRematch}
          onLeave={api.leaveRoom}
        />
      );
  } else if (api.resuming) {
    view = (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-amber" />
        <p>Rejoining your match…</p>
      </main>
    );
  } else {
    view = (
      <RoomLobby
        username={username}
        onUsernameChange={changeUsername}
        inviteCode={inviteCode}
        onDismissInvite={dismissInvite}
        connection={api.status}
        pending={api.pending}
        error={api.lobbyError}
        onClearError={api.clearLobbyError}
        onHost={api.hostGame}
        onJoin={api.joinGame}
      />
    );
  }

  return (
    <>
      {view}
      <Toast notice={api.notice} onDismiss={api.dismissNotice} duration={5000} />
      <Toast notice={moveToast} onDismiss={() => setMoveToast(null)} duration={2600} />
    </>
  );
}
