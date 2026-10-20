import {
  canCover,
  cloneBoard,
  createEmptyBoard,
  createReserve,
  findLines,
  isCellIndex,
  topPiece,
} from './Board.js';
import {
  opponentOf,
  type AppliedMove,
  type Board,
  type Color,
  type GameState,
  type Intent,
  type MoveResult,
  type Piece,
  type ValidationResult,
  type WinCheck,
} from './types.js';

const OK: ValidationResult = { valid: true };
const fail = (reason: string): ValidationResult => ({ valid: false, reason });

export function createInitialState(startingColor: Color = 'red'): GameState {
  return {
    board: createEmptyBoard(),
    reserves: { red: createReserve('red'), blue: createReserve('blue') },
    turn: startingColor,
    startingColor,
    status: 'playing',
    winner: null,
    winningLines: [],
    moveCount: 0,
    lastMove: null,
  };
}

function checkTurn(state: GameState, color: Color): ValidationResult {
  if (state.status !== 'playing') return fail('The game is already over.');
  if (state.turn !== color) return fail('It is not your turn.');
  return OK;
}

/** Action A: can `color` spawn reserve piece `pieceId` onto cell `to`? */
export function isValidPlacement(
  state: GameState,
  color: Color,
  pieceId: string,
  to: number,
): ValidationResult {
  const turn = checkTurn(state, color);
  if (!turn.valid) return turn;
  if (!isCellIndex(to)) return fail('That cell does not exist.');
  const piece = state.reserves[color].find((p) => p.id === pieceId);
  if (!piece) return fail('That piece is not in your reserve.');
  if (!canCover(piece, state.board[to])) {
    return fail('A piece can only go on an empty cell or over a strictly smaller piece.');
  }
  return OK;
}

/** Action B: can `color` move its visible piece on cell `from` to cell `to`? */
export function isValidMove(state: GameState, color: Color, from: number, to: number): ValidationResult {
  const turn = checkTurn(state, color);
  if (!turn.valid) return turn;
  if (!isCellIndex(from) || !isCellIndex(to)) return fail('That cell does not exist.');
  if (from === to) return fail('A piece must move to a different cell.');
  const piece = topPiece(state.board[from]);
  if (!piece) return fail('There is no piece on that cell.');
  if (piece.color !== color) return fail('You can only move your own visible pieces.');
  if (!canCover(piece, state.board[to])) {
    return fail('A piece can only go on an empty cell or over a strictly smaller piece.');
  }
  return OK;
}

export function isValidIntent(state: GameState, color: Color, intent: Intent): ValidationResult {
  return intent.type === 'PLACE_PIECE'
    ? isValidPlacement(state, color, intent.pieceId, intent.to)
    : isValidMove(state, color, intent.from, intent.to);
}

/**
 * Evaluates the visible top pieces of a board. Lines are reported for both
 * colours; when both colours have a line simultaneously the result is a draw.
 */
export function checkWinCondition(board: Board): WinCheck {
  const red = findLines(board, 'red');
  const blue = findLines(board, 'blue');
  const draw = red.length > 0 && blue.length > 0;
  const winner: Color | null = draw ? null : red.length > 0 ? 'red' : blue.length > 0 ? 'blue' : null;
  return { lines: { red, blue }, winner, draw };
}

/**
 * Every legal intent for `color`. Reserve placements are de-duplicated by size
 * (two pieces of the same size are interchangeable) unless `allPieceIds` is set.
 */
export function getLegalMoves(
  state: GameState,
  color: Color,
  options: { allPieceIds?: boolean } = {},
): Intent[] {
  if (state.status !== 'playing' || state.turn !== color) return [];
  const moves: Intent[] = [];

  const seenSizes = new Set<number>();
  for (const piece of state.reserves[color]) {
    if (!options.allPieceIds && seenSizes.has(piece.size)) continue;
    seenSizes.add(piece.size);
    state.board.forEach((stack, to) => {
      if (canCover(piece, stack)) moves.push({ type: 'PLACE_PIECE', pieceId: piece.id, to });
    });
  }

  state.board.forEach((fromStack, from) => {
    const piece = topPiece(fromStack);
    if (!piece || piece.color !== color) return;
    state.board.forEach((toStack, to) => {
      if (to !== from && canCover(piece, toStack)) moves.push({ type: 'MOVE_PIECE', from, to });
    });
  });

  return moves;
}

/** Legal destination cells for one selected piece (reserve piece id or board cell). */
export function getLegalDestinations(
  state: GameState,
  color: Color,
  selection: { pieceId: string } | { from: number },
): number[] {
  const result: number[] = [];
  for (let to = 0; to < state.board.length; to++) {
    const check =
      'pieceId' in selection
        ? isValidPlacement(state, color, selection.pieceId, to)
        : isValidMove(state, color, selection.from, to);
    if (check.valid) result.push(to);
  }
  return result;
}

/**
 * Applies an intent and returns the new immutable state. The win check runs on
 * the final board, after the piece has landed, which covers the edge cases:
 *  - lifting a piece that reveals an opponent's line hands them the win unless
 *    the moved piece lands on (and therefore breaks) that line;
 *  - revealing your own piece that completes a line wins for you;
 *  - if both players end up with a line at once, the game is a draw.
 */
export function applyMove(state: GameState, color: Color, intent: Intent): MoveResult {
  const validation = isValidIntent(state, color, intent);
  if (!validation.valid) return { ok: false, error: validation.reason ?? 'Illegal move.' };

  const board = cloneBoard(state.board);
  const reserves = { red: [...state.reserves.red], blue: [...state.reserves.blue] };
  let piece: Piece;
  let from: number | null = null;
  let revealed: string | null = null;

  if (intent.type === 'PLACE_PIECE') {
    const index = reserves[color].findIndex((p) => p.id === intent.pieceId);
    piece = reserves[color][index] as Piece;
    reserves[color].splice(index, 1);
  } else {
    from = intent.from;
    const source = board[from] as Piece[];
    piece = source.pop() as Piece;
    revealed = topPiece(source)?.id ?? null;
  }

  const target = board[intent.to] as Piece[];
  const covered = topPiece(target)?.id ?? null;
  target.push(piece);

  const move: AppliedMove = {
    type: intent.type,
    color,
    pieceId: piece.id,
    size: piece.size,
    from,
    to: intent.to,
    covered,
    revealed,
  };

  const win = checkWinCondition(board);
  const base = { board, reserves, startingColor: state.startingColor, moveCount: state.moveCount + 1, lastMove: move };

  if (win.draw) {
    return {
      ok: true,
      move,
      state: { ...base, turn: color, status: 'draw', winner: null, winningLines: [...win.lines.red, ...win.lines.blue] },
    };
  }
  if (win.winner) {
    return {
      ok: true,
      move,
      state: { ...base, turn: color, status: 'won', winner: win.winner, winningLines: win.lines[win.winner] },
    };
  }

  const next: GameState = { ...base, turn: opponentOf(color), status: 'playing', winner: null, winningLines: [] };
  // Safety net: a player with no legal action ends the game in a draw.
  if (getLegalMoves(next, next.turn).length === 0) {
    return { ok: true, move, state: { ...next, status: 'draw' } };
  }
  return { ok: true, move, state: next };
}

/** Small stateful wrapper used by the room manager. */
export class GameEngine {
  private current: GameState;

  constructor(startingColor: Color = 'red') {
    this.current = createInitialState(startingColor);
  }

  get state(): GameState {
    return this.current;
  }

  apply(color: Color, intent: Intent): MoveResult {
    const result = applyMove(this.current, color, intent);
    if (result.ok) this.current = result.state;
    return result;
  }

  reset(startingColor: Color = 'red'): void {
    this.current = createInitialState(startingColor);
  }
}
