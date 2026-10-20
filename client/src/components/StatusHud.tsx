import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Crown, LogOut, Wifi, WifiOff } from 'lucide-react';
import { inviteUrl } from '../lib/config';
import { useNow } from '../hooks/useNow';
import type { Color, ConnectionStatus, PublicPlayer, RoomSnapshot } from '../types';

function PlayerBadge({
  player,
  isYou,
  isTurn,
  remaining,
}: {
  player: PublicPlayer | undefined;
  isYou: boolean;
  isTurn: boolean;
  remaining: number | null;
}) {
  const color: Color = player?.color ?? (isYou ? 'red' : 'blue');
  const swatch = color === 'red' ? 'from-[#ff8a80] to-red-deep' : 'from-[#9cc4ff] to-blue-deep';
  const ring = color === 'red' ? 'ring-red-piece/70' : 'ring-blue-piece/70';
  return (
    <div
      className={`relative flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 py-2 transition-all duration-300 ${
        isTurn ? `bg-white/[0.07] ring-2 ${ring}` : 'bg-white/[0.03] ring-1 ring-white/[0.06]'
      } ${isYou ? 'flex-row-reverse text-right' : ''}`}
    >
      <span className={`h-8 w-8 shrink-0 rounded-full bg-linear-to-br ${swatch} shadow-inner ring-2 ring-black/30`} />
      <div className="min-w-0">
        <div className={`flex items-center gap-1 ${isYou ? 'justify-end' : ''}`}>
          {player?.isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-amber" aria-label="Host" />}
          <span className="truncate font-display text-[15px] font-semibold leading-tight">
            {player?.username ?? 'Waiting…'}
          </span>
        </div>
        <div className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {isYou ? 'You' : 'Opponent'} · {color}
          {remaining !== null && <span className="ml-1 text-amber normal-case">· reconnecting {remaining}s</span>}
        </div>
      </div>
      {isTurn && (
        <motion.span
          layoutId="turn-dot"
          className={`absolute -top-1 ${isYou ? 'left-3' : 'right-3'} h-2.5 w-2.5 rounded-full bg-amber shadow-[0_0_10px_var(--color-amber)]`}
        />
      )}
    </div>
  );
}

export interface StatusHudProps {
  room: RoomSnapshot;
  connection: ConnectionStatus;
  clockOffset: number;
  onLeave: () => void;
}

export function StatusHud({ room, connection, clockOffset, onLeave }: StatusHudProps) {
  const [copied, setCopied] = useState(false);
  const you = room.players.find((p) => p.color === room.yourColor);
  const opponent = room.players.find((p) => p.color !== room.yourColor);
  const game = room.game;
  const playing = game?.status === 'playing';
  const anyGrace = room.players.some((p) => p.graceExpiresAt !== null);
  const now = useNow(anyGrace) + clockOffset;
  const remainingFor = (p: PublicPlayer | undefined) =>
    p?.graceExpiresAt ? Math.max(0, Math.ceil((p.graceExpiresAt - now) / 1000)) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(room.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <header className="w-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={copy}
          className="group flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-1.5 ring-1 ring-white/[0.08] hover:bg-white/[0.08]"
          title="Copy invite link"
        >
          <span className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Room</span>
          <span className="font-display text-lg font-semibold tracking-[0.2em] text-cream">{room.code}</span>
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-muted group-hover:text-cream" />}
        </button>
        <div className="flex items-center gap-1">
          <span
            className={`mr-1 hidden items-center gap-1 text-xs sm:flex ${connection === 'connected' ? 'text-emerald-400/80' : 'text-amber'}`}
          >
            {connection === 'connected' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connection === 'connected' ? 'Live' : 'Reconnecting'}
          </span>
          <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-xs font-semibold text-muted ring-1 ring-white/[0.06]">
            Round {room.round}
          </span>
          <button type="button" className="btn btn-ghost text-sm!" onClick={onLeave} title="Leave room">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <PlayerBadge player={opponent} isYou={false} isTurn={playing && game?.turn === opponent?.color} remaining={remainingFor(opponent)} />
        <span className="self-center font-display text-sm font-semibold text-muted/70">vs</span>
        <PlayerBadge player={you} isYou isTurn={playing && game?.turn === you?.color} remaining={remainingFor(you)} />
      </div>
    </header>
  );
}
