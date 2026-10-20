import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { inviteUrl } from '../lib/config';
import type { RoomSnapshot } from '../types';
import { PieceArt } from './Piece';

export function WaitingRoom({ room, onLeave }: { room: RoomSnapshot; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = inviteUrl(room.code);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'Advanced Tic-Tac-Toe', text: `Join my game! Room ${room.code}`, url: link });
    } catch {
      /* dismissed */
    }
  };

  return (
    <motion.main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-end justify-center gap-3" aria-hidden>
        {[1, 2, 3].map((size, i) => (
          <motion.div
            key={size}
            style={{ width: 24 + size * 20, height: 24 + size * 20 }}
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          >
            <PieceArt color="red" size={size as 1 | 2 | 3} />
          </motion.div>
        ))}
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold">Waiting for an opponent…</h1>
        <p className="mt-1 text-muted">Share this code or link. You'll play as Red and move first.</p>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Room code</div>
          <div className="mt-1 font-display text-5xl font-bold tracking-[0.3em] text-amber">{room.code}</div>
        </div>
        <div className="truncate rounded-xl bg-black/30 px-3 py-2 font-mono text-sm text-cream/80 ring-1 ring-white/[0.06]">{link}</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" onClick={copy}>
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? 'Copied!' : 'Copy link'}
          </button>
          {canShare ? (
            <button type="button" className="btn btn-secondary" onClick={share}>
              <Share2 className="h-5 w-5" /> Share
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={onLeave}>
              <X className="h-5 w-5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {canShare && (
        <button type="button" className="btn btn-ghost mx-auto text-sm" onClick={onLeave}>
          <X className="h-4 w-4" /> Cancel and close room
        </button>
      )}
    </motion.main>
  );
}
