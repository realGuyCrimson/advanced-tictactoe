import {
  BOARD_CELLS,
  MAX_STACK_DEPTH,
  PIECES_PER_SIZE,
  SIZES,
  type Board,
  type CellStack,
  type Color,
  type Piece,
} from './types.js';

/** All eight winning lines: 3 rows, 3 columns, 2 diagonals. */
export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_CELLS }, () => []);
}

/** Builds a fresh reserve of 2 Small, 2 Medium and 2 Large pieces for `color`. */
export function createReserve(color: Color): Piece[] {
  const pieces: Piece[] = [];
  for (const size of SIZES) {
    for (let i = 0; i < PIECES_PER_SIZE; i++) {
      pieces.push({ id: `${color}-${size}-${i}`, color, size });
    }
  }
  return pieces;
}

export function isCellIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BOARD_CELLS;
}

export function topPiece(stack: CellStack | undefined): Piece | null {
  if (!stack || stack.length === 0) return null;
  return stack[stack.length - 1] ?? null;
}

/**
 * A piece may land on a cell when the cell is empty or its top piece is
 * strictly smaller. Equal sizes can never cover each other; colour is
 * irrelevant, so self-gobbling is allowed.
 */
export function canCover(piece: Piece, stack: CellStack | undefined): boolean {
  if (!stack) return false;
  if (stack.length >= MAX_STACK_DEPTH) return false;
  const top = topPiece(stack);
  return top === null || piece.size > top.size;
}

/** The colour controlling each cell (its visible top piece), `null` if empty. */
export function visibleOwners(board: Board): (Color | null)[] {
  return board.map((stack) => topPiece(stack)?.color ?? null);
}

/** Every line of three visible pieces of `color`. Piece size does not matter. */
export function findLines(board: Board, color: Color): number[][] {
  const owners = visibleOwners(board);
  return WIN_LINES.filter((line) => line.every((cell) => owners[cell] === color)).map((line) => [
    ...line,
  ]);
}

export function cloneBoard(board: Board): Piece[][] {
  return board.map((stack) => [...stack]);
}

export function findPieceOnBoard(board: Board, pieceId: string): { cell: number; depth: number } | null {
  for (let cell = 0; cell < board.length; cell++) {
    const stack = board[cell] ?? [];
    const depth = stack.findIndex((p) => p.id === pieceId);
    if (depth !== -1) return { cell, depth };
  }
  return null;
}
