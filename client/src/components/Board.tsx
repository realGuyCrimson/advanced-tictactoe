import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { SIZE_NAMES } from '@shared/engine/types';
import { PIECE_PX } from '../lib/assets';
import type { Board as BoardModel, Color, Size } from '../types';
import { Cell } from './Cell';
import { Piece } from './Piece';

/** Vertical position of the cell centre inside a piece sprite (0 = top, 1 = bottom). */
const SPRITE_ANCHOR = 0.62;
/** Cell width (px) at which pieces render at their nominal 48 / 72 / 96 px. */
const NOMINAL_CELL = 120;

export interface PieceTarget {
  /** Viewport coordinates of the piece box centre. */
  x: number;
  y: number;
  px: number;
}

export interface BoardHandle {
  getPieceTarget: (cell: number, size: Size) => PieceTarget | null;
  scale: () => number;
}

interface CellGeometry {
  x: number;
  y: number;
  w: number;
}

export interface BoardProps {
  board: BoardModel;
  yourColor: Color;
  selectedCell: number | null;
  legalCells: ReadonlySet<number>;
  winningCells: ReadonlySet<number>;
  lastMoveCell: number | null;
  hiddenPieceId: string | null;
  revealedPieceId: string | null;
  /** True while the local player may act. */
  interactive: boolean;
  onCellClick: (cell: number) => void;
  /** Reports the piece scale derived from the rendered cell size. */
  onScaleChange?: (scale: number) => void;
  ref?: Ref<BoardHandle>;
}

const describeCell = (board: BoardModel, i: number, yourColor: Color, legal: boolean): string => {
  const stack = board[i] ?? [];
  const top = stack[stack.length - 1];
  const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
  const contents = top
    ? `${top.color === yourColor ? 'your' : "opponent's"} ${SIZE_NAMES[top.size].toLowerCase()} piece on top${
        stack.length > 1 ? `, ${stack.length - 1} hidden below` : ''
      }`
    : 'empty';
  return `${where}: ${contents}${legal ? '. Legal destination' : ''}`;
};

export function Board({
  board,
  yourColor,
  selectedCell,
  legalCells,
  winningCells,
  lastMoveCell,
  hiddenPieceId,
  revealedPieceId,
  interactive,
  onCellClick,
  onScaleChange,
  ref,
}: BoardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [cells, setCells] = useState<CellGeometry[]>([]);

  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const origin = wrapper.getBoundingClientRect();
    const next = tileRefs.current.map((tile) => {
      if (!tile) return { x: 0, y: 0, w: 0 };
      const r = tile.getBoundingClientRect();
      return { x: r.left - origin.left + r.width / 2, y: r.top - origin.top + r.height / 2, w: r.width };
    });
    setCells((prev) =>
      prev.length === next.length &&
      prev.every((c, i) => Math.abs(c.x - next[i]!.x) < 0.5 && Math.abs(c.y - next[i]!.y) < 0.5 && Math.abs(c.w - next[i]!.w) < 0.5)
        ? prev
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const scale = Math.min(1, Math.max(0.5, (cells[0]?.w ?? NOMINAL_CELL) / NOMINAL_CELL));

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  useImperativeHandle(
    ref,
    () => ({
      scale: () => scale,
      getPieceTarget: (cell, size) => {
        const wrapper = wrapperRef.current;
        const geo = cells[cell];
        if (!wrapper || !geo) return null;
        const origin = wrapper.getBoundingClientRect();
        const px = PIECE_PX[size] * scale;
        return { x: origin.left + geo.x, y: origin.top + geo.y - SPRITE_ANCHOR * px + px / 2, px };
      },
    }),
    [cells, scale],
  );

  return (
    <div ref={wrapperRef} className="relative mx-auto w-full max-w-[420px] select-none pt-12 pb-6">
      <div className="board-perspective">
        <div className="board-tilt board-frame p-[4.5%]">
          <div className="grid grid-cols-3 gap-[3.5%]" role="grid" aria-label="Game board">
            {Array.from({ length: 9 }, (_, i) => {
              const top = board[i]?.[board[i]!.length - 1];
              const ownTop = top?.color === yourColor;
              const legal = legalCells.has(i);
              return (
                <Cell
                  key={i}
                  ref={(el) => {
                    tileRefs.current[i] = el;
                  }}
                  index={i}
                  legal={legal}
                  win={winningCells.has(i)}
                  last={lastMoveCell === i}
                  selected={selectedCell === i}
                  clickable={interactive && (legal || ownTop)}
                  label={describeCell(board, i, yourColor, legal)}
                  onClick={onCellClick}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Flat piece layer: sprites stay upright while the board recedes in perspective. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {cells.length === 9 &&
          board.map((stack, i) => {
            const geo = cells[i]!;
            const row = Math.floor(i / 3);
            const lifted = selectedCell === i;
            const legal = legalCells.has(i);
            return (
              <div
                key={i}
                className="absolute"
                style={{ left: geo.x, top: geo.y, zIndex: lifted ? 50 : 10 + row * 10 }}
              >
                {stack.map((piece, depth) => {
                  const isTop = depth === stack.length - 1;
                  const px = PIECE_PX[piece.size] * scale;
                  const revealed = piece.id === revealedPieceId;
                  const clickable = isTop && interactive && (legal || piece.color === yourColor);
                  return (
                    <Piece
                      key={revealed ? `${piece.id}:revealed` : piece.id}
                      piece={piece}
                      px={px}
                      lifted={isTop && lifted}
                      hidden={piece.id === hiddenPieceId}
                      reveal={revealed}
                      // Top piece at 30 conceals smaller pieces nested underneath (20, 10).
                      zIndex={30 - (stack.length - 1 - depth) * 10}
                      style={{
                        left: -px / 2,
                        top: -SPRITE_ANCHOR * px,
                        pointerEvents: isTop ? 'auto' : 'none',
                        cursor: clickable ? 'pointer' : 'default',
                      }}
                      onClick={isTop ? () => onCellClick(i) : undefined}
                    />
                  );
                })}
              </div>
            );
          })}
      </div>
    </div>
  );
}
