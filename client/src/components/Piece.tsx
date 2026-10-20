import { memo, useId, useState, type CSSProperties, type MouseEventHandler } from 'react';
import { motion } from 'motion/react';
import { pieceSrc } from '../lib/assets';
import { pieceSvg } from '../lib/pieceArt';
import type { Color, Piece as PieceModel, Size } from '../types';

export const LIFT_SPRING = { type: 'spring', stiffness: 450, damping: 25 } as const;
export const REST_SHADOW = 'drop-shadow(0 3px 2px rgba(0,0,0,0.30))';
export const LIFT_SHADOW = 'drop-shadow(0 25px 15px rgba(0,0,0,0.25))';

/** The sprite, falling back to inline SVG art if the asset cannot be loaded. */
export const PieceArt = memo(function PieceArt({ color, size }: { color: Color; size: Size }) {
  const [failed, setFailed] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (failed) {
    return (
      <span
        aria-hidden
        className="piece-fallback block h-full w-full"
        dangerouslySetInnerHTML={{ __html: pieceSvg(color, size, uid) }}
      />
    );
  }
  return (
    <img
      className="piece-img"
      src={pieceSrc(color, size)}
      alt=""
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
});

export interface PieceProps {
  piece: PieceModel;
  px: number;
  lifted?: boolean;
  /** Hidden while an in-flight copy animates towards this spot. */
  hidden?: boolean;
  /** Play the "uncovered" fade/grow entrance. */
  reveal?: boolean;
  dimmed?: boolean;
  zIndex?: number;
  style?: CSSProperties;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  title?: string;
}

export function Piece({
  piece,
  px,
  lifted = false,
  hidden = false,
  reveal = false,
  dimmed = false,
  zIndex,
  style,
  className = '',
  onClick,
  title,
}: PieceProps) {
  return (
    <motion.div
      data-piece-id={piece.id}
      className={`absolute ${className}`}
      style={{ width: px, height: px, zIndex, ...style }}
      title={title}
      onClick={onClick}
      initial={reveal ? { opacity: 0.25, scale: 0.86 } : false}
      animate={{
        opacity: hidden ? 0 : dimmed ? 0.55 : 1,
        scale: lifted ? 1.15 : 1,
        y: lifted ? -32 : 0,
        filter: lifted ? LIFT_SHADOW : REST_SHADOW,
      }}
      transition={{
        ...LIFT_SPRING,
        // Snap visibility so a landing flight hands over without a flicker.
        opacity: { duration: reveal && !hidden ? 0.45 : 0 },
      }}
    >
      <PieceArt color={piece.color} size={piece.size} />
    </motion.div>
  );
}
