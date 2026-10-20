import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2, LogIn, Plus, ServerCrash, Wifi } from 'lucide-react';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, USERNAME_MAX_LENGTH } from '@shared/sockets/protocol';
import type { ConnectionStatus, RoomErrorPayload } from '../types';
import { HowToPlay } from './HowToPlay';
import { PieceArt } from './Piece';

export interface RoomLobbyProps {
  username: string;
  onUsernameChange: (name: string) => void;
  /** Room code taken from the URL (`/ABCDE`), if any. */
  inviteCode: string | null;
  onDismissInvite: () => void;
  connection: ConnectionStatus;
  pending: boolean;
  error: RoomErrorPayload | null;
  onClearError: () => void;
  onHost: (username: string) => void;
  onJoin: (code: string, username: string) => void;
}

const ALLOWED = new Set(ROOM_CODE_ALPHABET.split(''));
const cleanCode = (value: string) =>
  value
    .toUpperCase()
    .split('')
    .filter((c) => ALLOWED.has(c))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);

function Hero() {
  return (
    <div className="relative mx-auto mb-2 h-28 w-56" aria-hidden>
      <motion.div className="absolute bottom-0 left-2 h-[72px] w-[72px]" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05, type: 'spring', stiffness: 260, damping: 18 }}>
        <PieceArt color="blue" size={2} />
      </motion.div>
      <motion.div className="absolute bottom-1 left-1/2 h-24 w-24 -translate-x-1/2" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 16 }}>
        <PieceArt color="red" size={3} />
      </motion.div>
      <motion.div className="absolute right-4 bottom-0 h-12 w-12" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12, type: 'spring', stiffness: 260, damping: 18 }}>
        <PieceArt color="blue" size={1} />
      </motion.div>
    </div>
  );
}

export function RoomLobby({
  username,
  onUsernameChange,
  inviteCode,
  onDismissInvite,
  connection,
  pending,
  error,
  onClearError,
  onHost,
  onJoin,
}: RoomLobbyProps) {
  const [code, setCode] = useState(inviteCode ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (inviteCode) setCode(inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    if (!username.trim()) nameRef.current?.focus();
    else if (inviteCode) joinRef.current?.focus();
  }, [inviteCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = username.trim();
  const nameMissing = name.length === 0;
  const connected = connection === 'connected';
  const canAct = connected && !pending && !nameMissing;
  const codeComplete = code.length === ROOM_CODE_LENGTH;

  const host = () => {
    setNameTouched(true);
    if (!canAct) return nameRef.current?.focus();
    onHost(name);
  };

  const join = (e?: FormEvent) => {
    e?.preventDefault();
    setNameTouched(true);
    if (nameMissing) return nameRef.current?.focus();
    if (!canAct || !codeComplete) return;
    onJoin(code, name);
  };

  return (
    <motion.main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="text-center">
        <Hero />
        <h1 className="font-display text-[2.35rem] leading-[1.05] font-bold tracking-tight sm:text-5xl">
          Advanced <span className="whitespace-nowrap text-amber">Tic-Tac-Toe</span>
        </h1>
        <p className="mt-2 text-muted">Gobble, stack and line up three. Real-time with a friend.</p>
      </div>

      <form className="card space-y-4 p-5" onSubmit={join} noValidate>
        {inviteCode && (
          <div className="rounded-2xl bg-amber/10 px-4 py-3 text-center ring-1 ring-amber/30">
            <div className="text-xs font-semibold tracking-[0.16em] text-amber uppercase">You're invited</div>
            <div className="mt-0.5 font-display text-3xl font-bold tracking-[0.25em]">{inviteCode}</div>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Your name</span>
          <input
            ref={nameRef}
            className="field"
            value={username}
            maxLength={USERNAME_MAX_LENGTH}
            placeholder="e.g. Alex"
            autoComplete="nickname"
            onChange={(e) => onUsernameChange(e.target.value)}
            onBlur={() => setNameTouched(true)}
            aria-invalid={nameTouched && nameMissing}
          />
          {nameTouched && nameMissing && <span className="mt-1 block text-xs text-amber">Enter a name to play.</span>}
        </label>

        {inviteCode ? (
          <div className="grid gap-2">
            <button ref={joinRef} type="submit" className="btn btn-primary" disabled={!connected || pending}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />} Join Game
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => {
                onDismissInvite();
                setCode('');
                onClearError();
              }}
            >
              Host a new game instead
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-primary w-full" onClick={host} disabled={!connected || pending}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Host Game
            </button>

            <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-muted/70 uppercase">
              <span className="h-px flex-1 bg-white/10" /> or join a friend <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                className="field flex-1 text-center font-display text-xl font-semibold tracking-[0.35em] uppercase placeholder:tracking-[0.2em]"
                value={code}
                placeholder="CODE"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Room code"
                onChange={(e) => {
                  setCode(cleanCode(e.target.value));
                  if (error) onClearError();
                }}
              />
              <button type="submit" className="btn btn-secondary" disabled={!connected || pending || !codeComplete} aria-label="Join Game">
                Join <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-piece/15 px-3 py-2 text-sm text-[#ffb4ae] ring-1 ring-red-piece/30">
            {error.message}
          </p>
        )}

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
          {connection === 'connected' ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-400" /> Connected to game server
            </>
          ) : connection === 'offline' ? (
            <>
              <ServerCrash className="h-3.5 w-3.5 text-amber" /> Can't reach the game server — retrying…
            </>
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to game server… (can take ~30s to wake up)
            </>
          )}
        </div>
      </form>

      <HowToPlay />
    </motion.main>
  );
}
