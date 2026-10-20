import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowLeftRight, Check, Eye, Handshake, Hourglass, LogOut, RotateCcw, Trophy, Frown } from 'lucide-react';
import type { Color, PublicPlayer } from '../types';

export type Outcome = 'win' | 'lose' | 'draw';

const CONFETTI_COLORS: Record<Color, string[]> = {
  red: ['#ea3d43', '#ff9a8b', '#f5b544', '#ffe1dc'],
  blue: ['#3d84f7', '#a5ccff', '#f5b544', '#e0edff'],
};

/** Victory fanfare: a central burst followed by two side cannons. */
function celebrate(color: Color): () => void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => undefined;
  const colors = CONFETTI_COLORS[color];
  confetti({ particleCount: 140, spread: 80, startVelocity: 48, origin: { y: 0.62 }, colors, zIndex: 80 });
  const end = Date.now() + 1400;
  let frame = 0;
  const tick = () => {
    confetti({ particleCount: 4, angle: 60, spread: 58, origin: { x: 0, y: 0.75 }, colors, zIndex: 80 });
    confetti({ particleCount: 4, angle: 120, spread: 58, origin: { x: 1, y: 0.75 }, colors, zIndex: 80 });
    if (Date.now() < end) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    confetti.reset();
  };
}

export interface GameOverModalProps {
  outcome: Outcome;
  yourColor: Color;
  players: readonly PublicPlayer[];
  /** Why the game ended, e.g. "Bob lined up three". */
  detail: string;
  onToggleRematch: (wants: boolean) => void;
  onLeave: () => void;
  onHide: () => void;
}

export function GameOverModal({ outcome, yourColor, players, detail, onToggleRematch, onLeave, onHide }: GameOverModalProps) {
  const you = players.find((p) => p.color === yourColor);
  const opponent = players.find((p) => p.color !== yourColor);
  const wantsRematch = you?.wantsRematch ?? false;

  useEffect(() => {
    if (outcome === 'win') return celebrate(yourColor);
  }, [outcome, yourColor]);

  const headline = outcome === 'win' ? 'Victory!' : outcome === 'lose' ? 'Defeat' : 'Draw';
  const Icon = outcome === 'win' ? Trophy : outcome === 'lose' ? Frown : Handshake;
  const iconTone =
    outcome === 'win'
      ? 'from-[#ffe08a] to-amber-deep text-[#3b2303]'
      : outcome === 'lose'
        ? 'from-white/20 to-white/5 text-cream'
        : 'from-[#cbd5e1] to-[#64748b] text-[#0f172a]';

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 backdrop-blur-[3px] sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <motion.div
        className="card relative w-full max-w-sm p-6 text-center"
        initial={{ y: 40, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <button
          type="button"
          onClick={onHide}
          className="btn btn-ghost absolute top-3 right-3 px-2! py-1.5! text-xs!"
          title="Hide to view the board"
        >
          <Eye className="h-4 w-4" /> Board
        </button>

        <motion.div
          className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br shadow-lg ${iconTone}`}
          initial={{ rotate: -12, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
        >
          <Icon className="h-8 w-8" />
        </motion.div>
        <h2 id="game-over-title" className="font-display text-4xl font-bold tracking-tight">
          {headline}
        </h2>
        <p className="mt-1 text-sm text-muted">{detail}</p>

        <div className="mt-5 space-y-2 rounded-2xl bg-black/25 p-3 text-left ring-1 ring-white/[0.06]">
          {[you, opponent].map((p, i) =>
            p ? (
              <div key={p.color} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${p.color === 'red' ? 'bg-red-piece' : 'bg-blue-piece'}`} />
                  <span className="truncate font-medium">{i === 0 ? `${p.username} (you)` : p.username}</span>
                </span>
                {p.wantsRematch ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Ready
                  </span>
                ) : !p.connected ? (
                  <span className="text-xs font-semibold text-amber">Reconnecting…</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Hourglass className="h-3.5 w-3.5" /> Deciding
                  </span>
                )}
              </div>
            ) : null,
          )}
          <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted">
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            Colours swap on a rematch — the new Red moves first.
          </p>
        </div>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            className={`btn ${wantsRematch ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => onToggleRematch(!wantsRematch)}
            aria-pressed={wantsRematch}
          >
            {wantsRematch ? (
              <>
                <Check className="h-5 w-5" /> Waiting for {opponent?.username ?? 'opponent'}… (cancel)
              </>
            ) : (
              <>
                <RotateCcw className="h-5 w-5" /> {opponent?.wantsRematch ? 'Accept rematch' : 'Rematch'}
              </>
            )}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onLeave}>
            <LogOut className="h-5 w-5" /> Leave Room
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
