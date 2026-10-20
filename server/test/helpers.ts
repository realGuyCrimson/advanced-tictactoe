import { createReserve } from '../src/engine/Board.js';
import { createInitialState } from '../src/engine/GameEngine.js';
import type { Color, GameState, Piece, Size } from '../src/engine/types.js';

/**
 * Builds a game state from a compact layout. Each cell lists its stack from
 * bottom to top using tokens like `R3` (red large) or `B1` (blue small).
 * Pieces used on the board are removed from the matching reserve.
 */
export function stateFrom(
  layout: Partial<Record<number, string[]>>,
  overrides: Partial<GameState> = {},
): GameState {
  const reserves: Record<Color, Piece[]> = { red: createReserve('red'), blue: createReserve('blue') };
  const board: Piece[][] = Array.from({ length: 9 }, () => []);
  for (const [cell, tokens] of Object.entries(layout)) {
    for (const token of tokens ?? []) {
      const color: Color = token[0] === 'R' ? 'red' : 'blue';
      const size = Number(token[1]) as Size;
      const index = reserves[color].findIndex((p) => p.size === size);
      if (index === -1) throw new Error(`No ${token} left in reserve for layout`);
      const [piece] = reserves[color].splice(index, 1);
      board[Number(cell)]!.push(piece!);
    }
  }
  return { ...createInitialState('red'), board, reserves, ...overrides };
}

export function reservePiece(state: GameState, color: Color, size: Size): Piece {
  const piece = state.reserves[color].find((p) => p.size === size);
  if (!piece) throw new Error(`No ${color} size ${size} in reserve`);
  return piece;
}
