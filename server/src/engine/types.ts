/**
 * Core type definitions for the Advanced Tic-Tac-Toe (Gobblet Junior) engine.
 *
 * Everything in `engine/` is pure TypeScript with zero runtime dependencies so
 * it can be shared verbatim by the server (authoritative validation) and the
 * client (legal-move highlighting).
 */

export type Color = 'red' | 'blue';

/** 1 = Small, 2 = Medium, 3 = Large. */
export type Size = 1 | 2 | 3;

export const COLORS: readonly Color[] = ['red', 'blue'];
export const SIZES: readonly Size[] = [1, 2, 3];

export const SIZE_NAMES: Record<Size, string> = {
  1: 'Small',
  2: 'Medium',
  3: 'Large',
};

/** Number of cells on the board (3 x 3). */
export const BOARD_CELLS = 9;
/** A cell can hold at most one piece of each size, so 3 nested layers. */
export const MAX_STACK_DEPTH = 3;
/** Pieces of each size in a player's reserve. */
export const PIECES_PER_SIZE = 2;

export interface Piece {
  readonly id: string;
  readonly color: Color;
  readonly size: Size;
}

/** LIFO stack: index 0 is the bottom piece, the last element is the visible top piece. */
export type CellStack = readonly Piece[];

/** The 3 x 3 board, cells indexed 0..8 in row-major order. */
export type Board = readonly CellStack[];

export type Reserves = Readonly<Record<Color, readonly Piece[]>>;

export type GameStatus = 'playing' | 'won' | 'draw';

/** Action A: spawn a piece from the reserve. */
export interface PlaceIntent {
  readonly type: 'PLACE_PIECE';
  readonly pieceId: string;
  readonly to: number;
}

/** Action B: move one of your visible pieces already on the board. */
export interface MoveIntent {
  readonly type: 'MOVE_PIECE';
  readonly from: number;
  readonly to: number;
}

export type Intent = PlaceIntent | MoveIntent;

/** A fully resolved move, recorded on the state after it has been applied. */
export interface AppliedMove {
  readonly type: Intent['type'];
  readonly color: Color;
  readonly pieceId: string;
  readonly size: Size;
  /** Source cell for MOVE_PIECE, `null` for PLACE_PIECE. */
  readonly from: number | null;
  readonly to: number;
  /** Id of the piece that was gobbled at the destination, if any. */
  readonly covered: string | null;
  /** Id of the piece uncovered at the source cell, if any. */
  readonly revealed: string | null;
}

export interface GameState {
  readonly board: Board;
  readonly reserves: Reserves;
  /** Whose turn it is. After the game ends this is the player who made the final move. */
  readonly turn: Color;
  readonly startingColor: Color;
  readonly status: GameStatus;
  /** Winning color, `null` while playing or on a draw. */
  readonly winner: Color | null;
  /** Every completed line on the final board (both colors on a simultaneous-win draw). */
  readonly winningLines: readonly (readonly number[])[];
  readonly moveCount: number;
  readonly lastMove: AppliedMove | null;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly move: AppliedMove }
  | { readonly ok: false; readonly error: string };

export interface WinCheck {
  /** Completed lines per color, each line being three cell indices. */
  readonly lines: Readonly<Record<Color, readonly (readonly number[])[]>>;
  /** The sole winner, or `null` if nobody or both players completed a line. */
  readonly winner: Color | null;
  /** `true` when both players have a completed line at the same time. */
  readonly draw: boolean;
}

export function opponentOf(color: Color): Color {
  return color === 'red' ? 'blue' : 'red';
}
