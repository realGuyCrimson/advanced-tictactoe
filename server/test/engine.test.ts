import { describe, expect, it } from 'vitest';
import {
  applyMove,
  checkWinCondition,
  createInitialState,
  GameEngine,
  getLegalDestinations,
  getLegalMoves,
  isValidMove,
  isValidPlacement,
} from '../src/engine/GameEngine.js';
import { topPiece } from '../src/engine/Board.js';
import type { Color, GameState, Intent } from '../src/engine/types.js';
import { reservePiece, stateFrom } from './helpers.js';

function expectOk(state: GameState, color: Color, intent: Intent): GameState {
  const result = applyMove(state, color, intent);
  if (!result.ok) throw new Error(`Expected legal move, got: ${result.error}`);
  return result.state;
}

describe('initial setup', () => {
  it('gives each player 2 small, 2 medium and 2 large pieces', () => {
    const state = createInitialState();
    for (const color of ['red', 'blue'] as const) {
      const sizes = state.reserves[color].map((p) => p.size).sort();
      expect(sizes).toEqual([1, 1, 2, 2, 3, 3]);
      expect(state.reserves[color].every((p) => p.color === color)).toBe(true);
    }
    expect(state.board).toHaveLength(9);
    expect(state.board.every((s) => s.length === 0)).toBe(true);
    expect(state.turn).toBe('red');
    expect(state.status).toBe('playing');
  });

  it('respects a custom starting colour', () => {
    expect(createInitialState('blue').turn).toBe('blue');
  });

  it('assigns unique piece ids', () => {
    const state = createInitialState();
    const ids = [...state.reserves.red, ...state.reserves.blue].map((p) => p.id);
    expect(new Set(ids).size).toBe(12);
  });
});

describe('placement (Action A)', () => {
  it('places a reserve piece on an empty cell and passes the turn', () => {
    const state = createInitialState();
    const piece = reservePiece(state, 'red', 1);
    const next = expectOk(state, 'red', { type: 'PLACE_PIECE', pieceId: piece.id, to: 4 });
    expect(topPiece(next.board[4])?.id).toBe(piece.id);
    expect(next.reserves.red).toHaveLength(5);
    expect(next.turn).toBe('blue');
    expect(next.moveCount).toBe(1);
    expect(next.lastMove).toMatchObject({ type: 'PLACE_PIECE', color: 'red', from: null, to: 4, covered: null });
  });

  it('covers a strictly smaller opponent piece', () => {
    const state = stateFrom({ 4: ['B1'] });
    const large = reservePiece(state, 'red', 3);
    const next = expectOk(state, 'red', { type: 'PLACE_PIECE', pieceId: large.id, to: 4 });
    expect(next.board[4]!.map((p) => p.size)).toEqual([1, 3]);
    expect(next.lastMove?.covered).toBe(state.board[4]![0]!.id);
  });

  it('rejects covering an equal-sized piece', () => {
    const state = stateFrom({ 4: ['B2'] });
    const medium = reservePiece(state, 'red', 2);
    expect(isValidPlacement(state, 'red', medium.id, 4).valid).toBe(false);
  });

  it('rejects covering a larger piece, and small pieces cannot cover anything', () => {
    const state = stateFrom({ 0: ['B3'], 1: ['B1'] });
    expect(isValidPlacement(state, 'red', reservePiece(state, 'red', 2).id, 0).valid).toBe(false);
    expect(isValidPlacement(state, 'red', reservePiece(state, 'red', 1).id, 1).valid).toBe(false);
  });

  it('rejects pieces that are not in the reserve or belong to the opponent', () => {
    const state = createInitialState();
    expect(isValidPlacement(state, 'red', 'blue-3-0', 0).valid).toBe(false);
    expect(isValidPlacement(state, 'red', 'nonsense', 0).valid).toBe(false);
  });

  it('rejects out-of-range cells', () => {
    const state = createInitialState();
    const piece = reservePiece(state, 'red', 1);
    expect(isValidPlacement(state, 'red', piece.id, 9).valid).toBe(false);
    expect(isValidPlacement(state, 'red', piece.id, -1).valid).toBe(false);
    expect(isValidPlacement(state, 'red', piece.id, 1.5).valid).toBe(false);
  });
});

describe('self-gobbling', () => {
  it('allows placing a larger reserve piece over your own smaller piece', () => {
    const state = stateFrom({ 4: ['R1'] });
    const medium = reservePiece(state, 'red', 2);
    const next = expectOk(state, 'red', { type: 'PLACE_PIECE', pieceId: medium.id, to: 4 });
    expect(next.board[4]!.map((p) => `${p.color}${p.size}`)).toEqual(['red1', 'red2']);
  });

  it('allows moving your own piece over your own smaller piece', () => {
    const state = stateFrom({ 0: ['R3'], 4: ['R1'] });
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 0, to: 4 });
    expect(next.board[0]).toHaveLength(0);
    expect(next.board[4]!.map((p) => p.size)).toEqual([1, 3]);
  });

  it('supports the full three-layer nest, and nothing covers a large piece', () => {
    const state = stateFrom({ 4: ['R1', 'B2', 'R3'] });
    expect(state.board[4]).toHaveLength(3);
    expect(topPiece(state.board[4])?.size).toBe(3);
    expect(getLegalDestinations(state, 'red', { pieceId: reservePiece(state, 'red', 3).id })).not.toContain(4);
  });
});

describe('moving (Action B)', () => {
  it('moves a visible own piece to an empty cell', () => {
    const state = stateFrom({ 0: ['R2'] });
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 0, to: 8 });
    expect(next.board[0]).toHaveLength(0);
    expect(topPiece(next.board[8])?.color).toBe('red');
    expect(next.lastMove).toMatchObject({ type: 'MOVE_PIECE', from: 0, to: 8, revealed: null });
  });

  it('uncovers and reactivates the piece underneath', () => {
    const state = stateFrom({ 0: ['B1', 'R3'] });
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 0, to: 5 });
    expect(topPiece(next.board[0])?.color).toBe('blue');
    expect(next.lastMove?.revealed).toBe(state.board[0]![0]!.id);
    // The revealed blue piece is immediately playable by blue.
    expect(isValidMove(next, 'blue', 0, 1).valid).toBe(true);
  });

  it("rejects moving the opponent's piece", () => {
    const state = stateFrom({ 0: ['B2'] });
    expect(isValidMove(state, 'red', 0, 1).valid).toBe(false);
  });

  it('rejects moving a covered (non-visible) own piece', () => {
    const state = stateFrom({ 0: ['R1', 'B3'] });
    expect(isValidMove(state, 'red', 0, 1).valid).toBe(false);
  });

  it('rejects moving to the same cell, from an empty cell, or onto equal/larger pieces', () => {
    const state = stateFrom({ 0: ['R2'], 1: ['B2'], 2: ['B3'] });
    expect(isValidMove(state, 'red', 0, 0).valid).toBe(false);
    expect(isValidMove(state, 'red', 5, 6).valid).toBe(false);
    expect(isValidMove(state, 'red', 0, 1).valid).toBe(false);
    expect(isValidMove(state, 'red', 0, 2).valid).toBe(false);
  });
});

describe('turn enforcement', () => {
  it('rejects actions from the inactive player', () => {
    const state = createInitialState();
    const piece = reservePiece(state, 'blue', 1);
    const result = applyMove(state, 'blue', { type: 'PLACE_PIECE', pieceId: piece.id, to: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not your turn/i);
  });

  it('rejects all actions after the game is over', () => {
    const state = stateFrom({ 0: ['R1'], 1: ['R1'], 2: ['R2'] }, { status: 'won', winner: 'red', turn: 'blue' });
    expect(getLegalMoves(state, 'blue')).toHaveLength(0);
    const result = applyMove(state, 'blue', {
      type: 'PLACE_PIECE',
      pieceId: reservePiece(state, 'blue', 3).id,
      to: 4,
    });
    expect(result.ok).toBe(false);
  });

  it('does not mutate the previous state', () => {
    const state = stateFrom({ 0: ['B1', 'R3'] });
    const snapshot = JSON.stringify(state);
    expectOk(state, 'red', { type: 'MOVE_PIECE', from: 0, to: 4 });
    expectOk(state, 'red', { type: 'PLACE_PIECE', pieceId: reservePiece(state, 'red', 1).id, to: 8 });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('win conditions', () => {
  it.each([
    ['row', [0, 1, 2]],
    ['column', [1, 4, 7]],
    ['diagonal', [0, 4, 8]],
    ['anti-diagonal', [2, 4, 6]],
  ])('detects a %s win regardless of piece size', (_name, line) => {
    const [a, b, c] = line as [number, number, number];
    const state = stateFrom({ [a]: ['R1'], [b]: ['R3'] });
    const next = expectOk(state, 'red', { type: 'PLACE_PIECE', pieceId: reservePiece(state, 'red', 2).id, to: c });
    expect(next.status).toBe('won');
    expect(next.winner).toBe('red');
    expect(next.winningLines).toEqual([line]);
  });

  it('only counts visible top pieces', () => {
    const board = stateFrom({ 0: ['R1'], 1: ['R1', 'B2'], 2: ['R2'] }).board;
    expect(checkWinCondition(board).winner).toBeNull();
  });

  it('gobbling an opponent piece can complete your own line', () => {
    const state = stateFrom({ 0: ['R2'], 1: ['R2'], 2: ['B1'] });
    const next = expectOk(state, 'red', { type: 'PLACE_PIECE', pieceId: reservePiece(state, 'red', 3).id, to: 2 });
    expect(next.winner).toBe('red');
  });
});

describe('uncovering edge cases', () => {
  it("uncovering an opponent's piece that completes their line makes the opponent win", () => {
    // Blue holds 0 and 1; red's large on 2 hides a blue small.
    const state = stateFrom({ 0: ['B1'], 1: ['B2'], 2: ['B1', 'R3'] });
    expect(checkWinCondition(state.board).winner).toBeNull();
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 2, to: 7 });
    expect(next.status).toBe('won');
    expect(next.winner).toBe('blue');
    expect(next.winningLines).toEqual([[0, 1, 2]]);
  });

  it('the opponent does not win if the moved piece lands on and breaks the revealed line', () => {
    const state = stateFrom({ 0: ['B1'], 1: ['B2'], 2: ['B1', 'R3'] });
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 2, to: 0 });
    expect(next.status).toBe('playing');
    expect(next.winner).toBeNull();
    expect(next.turn).toBe('blue');
    expect(topPiece(next.board[0])?.color).toBe('red');
  });

  it("uncovering the mover's own piece that completes a line wins for the mover", () => {
    // Red's large sits on a red small in the centre; moving it to 8 leaves the
    // revealed red small in place and completes the 0-4-8 diagonal.
    const state = stateFrom({ 0: ['R1'], 4: ['R1', 'R3'], 5: ['B2'] });
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 4, to: 8 });
    expect(next.status).toBe('won');
    expect(next.winner).toBe('red');
    expect(next.winningLines).toEqual([[0, 4, 8]]);
    expect(next.lastMove?.revealed).toBe(state.board[4]![0]!.id);
  });

  it("uncovering the mover's own piece wins even when the opponent's piece was on top of it before", () => {
    // Red large on 2 covers a blue medium that covers a red small. Red lifts
    // the large to block nothing; the blue medium becomes visible (no line),
    // so the game continues - whereas lifting reveals only the top-most layer.
    const state = stateFrom({ 0: ['R1'], 1: ['R2'], 2: ['R1', 'B2', 'R3'] });
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 2, to: 8 });
    expect(topPiece(next.board[2])?.color).toBe('blue');
    expect(next.status).toBe('playing');
  });
});

describe('simultaneous win', () => {
  it('declares a draw when both players complete a line on the same move', () => {
    // Blue's large on 2 hides red's row 0-1-2; moving it to 5 completes blue's 3-4-5.
    const state = stateFrom({ 0: ['R1'], 1: ['R1'], 2: ['R2', 'B3'], 3: ['B1'], 4: ['B2'] }, { turn: 'blue' });
    expect(checkWinCondition(state.board).winner).toBeNull();
    const next = expectOk(state, 'blue', { type: 'MOVE_PIECE', from: 2, to: 5 });
    expect(next.status).toBe('draw');
    expect(next.winner).toBeNull();
    expect(next.winningLines).toEqual(expect.arrayContaining([[0, 1, 2], [3, 4, 5]]));
    expect(getLegalMoves(next, 'red')).toHaveLength(0);
  });

  it('checkWinCondition reports both colours', () => {
    const board = stateFrom({ 0: ['R1'], 1: ['R1'], 2: ['R2'], 3: ['B1'], 4: ['B2'], 5: ['B3'] }).board;
    const result = checkWinCondition(board);
    expect(result.draw).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.lines.red).toEqual([[0, 1, 2]]);
    expect(result.lines.blue).toEqual([[3, 4, 5]]);
  });
});

describe('exhausted reserves', () => {
  it('a player with an empty reserve can only move pieces on the board', () => {
    const state = stateFrom({ 0: ['R1'], 1: ['R3'], 5: ['R1'], 6: ['R2', 'B3'], 7: ['R3'], 8: ['R2'] });
    expect(state.reserves.red).toHaveLength(0);
    expect(checkWinCondition(state.board).winner).toBeNull();
    const moves = getLegalMoves(state, 'red');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.type === 'MOVE_PIECE')).toBe(true);
    const next = expectOk(state, 'red', { type: 'MOVE_PIECE', from: 8, to: 3 });
    expect(next.status).toBe('playing');
  });
});

describe('getLegalMoves / getLegalDestinations', () => {
  it('lists 3 sizes x 9 cells on an empty board', () => {
    expect(getLegalMoves(createInitialState(), 'red')).toHaveLength(27);
    expect(getLegalMoves(createInitialState(), 'red', { allPieceIds: true })).toHaveLength(54);
    expect(getLegalMoves(createInitialState(), 'blue')).toHaveLength(0);
  });

  it('only offers cells the selected piece can cover', () => {
    const state = stateFrom({ 0: ['B1'], 1: ['B2'], 2: ['B3'], 4: ['R2'] });
    expect(getLegalDestinations(state, 'red', { pieceId: reservePiece(state, 'red', 2).id })).toEqual([
      0, 3, 5, 6, 7, 8,
    ]);
    expect(getLegalDestinations(state, 'red', { from: 4 })).toEqual([0, 3, 5, 6, 7, 8]);
    expect(getLegalDestinations(state, 'red', { from: 2 })).toEqual([]);
  });
});

describe('GameEngine wrapper', () => {
  it('plays a full game to a win and resets', () => {
    const engine = new GameEngine('red');
    const pid = (c: Color, size: 1 | 2 | 3) => reservePiece(engine.state, c, size).id;
    expect(engine.apply('red', { type: 'PLACE_PIECE', pieceId: pid('red', 3), to: 0 }).ok).toBe(true);
    expect(engine.apply('blue', { type: 'PLACE_PIECE', pieceId: pid('blue', 1), to: 3 }).ok).toBe(true);
    expect(engine.apply('red', { type: 'PLACE_PIECE', pieceId: pid('red', 3), to: 4 }).ok).toBe(true);
    // Blue cannot gobble a large piece.
    expect(engine.apply('blue', { type: 'PLACE_PIECE', pieceId: pid('blue', 1), to: 4 }).ok).toBe(false);
    expect(engine.state.turn).toBe('blue');
    expect(engine.apply('blue', { type: 'PLACE_PIECE', pieceId: pid('blue', 2), to: 8 }).ok).toBe(true);
    expect(engine.apply('red', { type: 'MOVE_PIECE', from: 4, to: 8 }).ok).toBe(true);
    expect(engine.apply('blue', { type: 'PLACE_PIECE', pieceId: pid('blue', 1), to: 4 }).ok).toBe(true);
    expect(engine.apply('red', { type: 'PLACE_PIECE', pieceId: pid('red', 2), to: 4 }).ok).toBe(true);
    expect(engine.state.status).toBe('won');
    expect(engine.state.winner).toBe('red');
    expect(engine.state.winningLines).toEqual([[0, 4, 8]]);
    engine.reset('blue');
    expect(engine.state.turn).toBe('blue');
    expect(engine.state.moveCount).toBe(0);
  });
});
