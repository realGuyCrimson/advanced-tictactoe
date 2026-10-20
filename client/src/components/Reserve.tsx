import { SIZE_NAMES } from '@shared/engine/types';
import { PIECE_PX } from '../lib/assets';
import type { Color, Piece as PieceModel, Size } from '../types';
import { Piece } from './Piece';

const ORDER: Size[] = [3, 2, 1];

export interface ReserveProps {
  color: Color;
  pieces: readonly PieceModel[];
  owner: string;
  isMine: boolean;
  /** Piece scale relative to the nominal 48 / 72 / 96 px. */
  scale: number;
  selectedPieceId: string | null;
  hiddenPieceId: string | null;
  interactive: boolean;
  onSelect?: (pieceId: string) => void;
  active: boolean;
}

export function Reserve({
  color,
  pieces,
  owner,
  isMine,
  scale,
  selectedPieceId,
  hiddenPieceId,
  interactive,
  onSelect,
  active,
}: ReserveProps) {
  const slotHeight = PIECE_PX[3] * scale;
  const accent = color === 'red' ? 'bg-red-piece' : 'bg-blue-piece';

  return (
    <section
      aria-label={`${isMine ? 'Your' : `${owner}'s`} reserve`}
      className={`tray relative rounded-[22px] px-3 pt-2 pb-3 transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-80'
      }`}
    >
      <header className="mb-1 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${accent}`} />
          <span className="truncate">{isMine ? 'Your reserve' : `${owner}'s reserve`}</span>
        </span>
        <span className="tabular-nums">{pieces.length} left</span>
      </header>

      <div
        className="flex items-end justify-center gap-3 sm:gap-5"
        style={{ minHeight: slotHeight + 6, paddingTop: isMine ? 14 : 0 }}
      >
        {ORDER.map((size) => {
          const group = pieces.filter((p) => p.size === size);
          const px = PIECE_PX[size] * scale;
          const offset = Math.round(px * 0.3);
          const width = px + offset;
          return (
            <div
              key={size}
              className="relative"
              style={{ width, height: slotHeight }}
              aria-label={`${group.length} ${SIZE_NAMES[size].toLowerCase()} piece${group.length === 1 ? '' : 's'}`}
            >
              {group.length === 0 && (
                <span
                  aria-hidden
                  className="absolute rounded-[50%] border-2 border-dashed border-white/10"
                  style={{ width: px * 0.76, height: px * 0.3, left: (width - px * 0.76) / 2, bottom: px * 0.12 }}
                />
              )}
              {group.map((piece, i) => {
                const selected = piece.id === selectedPieceId;
                const clickable = interactive && isMine;
                return (
                  <Piece
                    key={piece.id}
                    piece={piece}
                    px={px}
                    lifted={selected}
                    hidden={piece.id === hiddenPieceId}
                    zIndex={selected ? 40 : 10 - i}
                    style={{
                      left: group.length === 1 ? offset / 2 : (1 - i) * offset,
                      bottom: 0,
                      cursor: clickable ? 'pointer' : 'default',
                      pointerEvents: clickable ? 'auto' : 'none',
                    }}
                    title={`${SIZE_NAMES[size]} piece`}
                    onClick={clickable ? () => onSelect?.(piece.id) : undefined}
                  />
                );
              })}
              {group.length > 1 && (
                <span className="pointer-events-none absolute -top-1 right-0 z-30 rounded-full bg-black/55 px-1.5 text-[10px] font-bold text-cream tabular-nums ring-1 ring-white/10">
                  ×{group.length}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
