import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import type { Piece as PieceModel } from '../types';
import { LIFT_SHADOW, PieceArt, REST_SHADOW } from './Piece';

export interface Flight {
  key: string;
  piece: PieceModel;
  /** Viewport centre of the source sprite and its current visual scale. */
  from: { x: number; y: number; scale: number };
  /** Viewport centre of the destination sprite. */
  to: { x: number; y: number };
  /** Destination sprite size in px. */
  px: number;
}

const DURATION = 0.62;
const TIMES = [0, 0.48, 0.8, 1];

/**
 * Animates a piece along a parabolic arc that peaks 50px above the higher end
 * of the jump, then lands with a small squash (scale 1.15 -> 0.95 -> 1.0).
 */
export function FlyingPiece({ flight, onLanded }: { flight: Flight; onLanded: () => void }) {
  const { from, to, px, piece } = flight;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const peak = Math.min(0, dy) - 50;

  // Safety net in case the animation is interrupted (tab hidden, etc.).
  useEffect(() => {
    const timer = setTimeout(onLanded, DURATION * 1000 + 400);
    return () => clearTimeout(timer);
  }, [flight.key, onLanded]);

  return createPortal(
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[60]"
      style={{ left: from.x - px / 2, top: from.y - px / 2, width: px, height: px }}
      initial={{ x: 0, y: 0, scale: from.scale, filter: LIFT_SHADOW }}
      animate={{
        x: [0, dx * 0.5, dx, dx],
        y: [0, peak, dy, dy],
        scale: [from.scale, 1.15, 0.95, 1],
        filter: [LIFT_SHADOW, LIFT_SHADOW, REST_SHADOW, REST_SHADOW],
      }}
      transition={{
        duration: DURATION,
        x: { duration: DURATION, times: TIMES, ease: ['linear', 'linear', 'linear'] },
        y: { duration: DURATION, times: TIMES, ease: ['easeOut', 'easeIn', 'linear'] },
        scale: { duration: DURATION, times: TIMES, ease: ['easeOut', 'easeIn', 'easeOut'] },
        filter: { duration: DURATION, times: TIMES },
      }}
      onAnimationComplete={onLanded}
    >
      <PieceArt color={piece.color} size={piece.size} />
    </motion.div>,
    document.body,
  );
}
