import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Trophy, WifiOff } from 'lucide-react';
import { getLegalDestinations } from '@shared/engine/GameEngine';
import { topPiece } from '@shared/engine/Board';
import { opponentOf } from '@shared/engine/types';
import type { Notice } from '../hooks/useGameSocket';
import type { ConnectionStatus, RoomSnapshot, Selection } from '../types';
import { Board, type BoardHandle } from './Board';
import { FlyingPiece, type Flight } from './FlyingPiece';
import { GameOverModal, type Outcome } from './GameOverModal';
import { Reserve } from './Reserve';
import { StatusHud } from './StatusHud';

export interface GameScreenProps {
  room: RoomSnapshot;
  connection: ConnectionStatus;
  clockOffset: number;
  moveError: Notice | null;
  onPlace: (pieceId: string, to: number) => void;
  onMove: (from: number, to: number) => void;
  onRematch: (wants: boolean) => void;
  onLeave: () => void;
}

const gameKey = (room: RoomSnapshot) => `${room.round}:${room.game?.moveCount ?? -1}`;

export function GameScreen({ room, connection, clockOffset, moveError, onPlace, onMove, onRematch, onLeave }: GameScreenProps) {
  const boardRef = useRef<BoardHandle>(null);
  const reduceMotion = useReducedMotion();

  // `shown` lags `room` by one layout pass so the outgoing DOM can be measured
  // before the next state renders — that is where each arc flight starts.
  const [shown, setShown] = useState(room);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [modalHidden, setModalHidden] = useState(false);
  const [modalReady, setModalReady] = useState(false);
  const [boardScale, setBoardScale] = useState(1);

  useLayoutEffect(() => {
    if (room === shown) return;
    const prev = shown.game;
    const next = room.game;
    const sameRound = room.round === shown.round;
    const advanced = !!prev && !!next && sameRound && next.moveCount === prev.moveCount + 1 && next.lastMove;

    if (advanced && next.lastMove) {
      const move = next.lastMove;
      const source = document.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(move.pieceId)}"]`);
      const target = boardRef.current?.getPieceTarget(move.to, move.size);
      if (source && target && !reduceMotion) {
        const rect = source.getBoundingClientRect();
        setFlight({
          key: `${room.round}:${next.moveCount}`,
          piece: { id: move.pieceId, color: move.color, size: move.size },
          from: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, scale: rect.width / target.px },
          to: { x: target.x, y: target.y },
          px: target.px,
        });
      } else {
        setFlight(null);
      }
      setRevealedId(move.revealed);
    } else if (gameKey(room) !== gameKey(shown)) {
      setFlight(null);
      setRevealedId(null);
    }
    setShown(room);
  }, [room, shown, reduceMotion]);

  const game = shown.game;
  const yourColor = shown.yourColor;
  const stateKey = gameKey(shown);

  // A new authoritative state always drops the local selection.
  useEffect(() => {
    setSelection(null);
    setAwaiting(false);
  }, [stateKey]);

  useEffect(() => {
    if (!moveError) return;
    setAwaiting(false);
    setSelection(null);
  }, [moveError]);

  useEffect(() => {
    setModalHidden(false);
    setModalReady(false);
  }, [shown.round]);

  const finished = !!game && game.status !== 'playing';
  useEffect(() => {
    if (!finished || flight) return;
    const timer = setTimeout(() => setModalReady(true), 450);
    return () => clearTimeout(timer);
  }, [finished, flight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !awaiting) setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [awaiting]);

  const myTurn = !!game && game.status === 'playing' && game.turn === yourColor;
  const interactive = myTurn && !flight && !awaiting && connection === 'connected';

  const legalCells = useMemo(() => {
    if (!game || !selection || !myTurn) return new Set<number>();
    const dests = getLegalDestinations(
      game,
      yourColor,
      selection.kind === 'reserve' ? { pieceId: selection.pieceId } : { from: selection.from },
    );
    return new Set(dests);
  }, [game, selection, myTurn, yourColor]);

  const winningCells = useMemo(() => new Set(game?.winningLines.flat() ?? []), [game]);

  const onCellClick = useCallback(
    (cell: number) => {
      if (!game || !interactive) return;
      if (selection && legalCells.has(cell)) {
        setAwaiting(true);
        if (selection.kind === 'reserve') onPlace(selection.pieceId, cell);
        else onMove(selection.from, cell);
        return;
      }
      const top = topPiece(game.board[cell]);
      if (top && top.color === yourColor) {
        setSelection((cur) => (cur?.kind === 'board' && cur.from === cell ? null : { kind: 'board', from: cell }));
      } else {
        setSelection(null);
      }
    },
    [game, interactive, selection, legalCells, onPlace, onMove, yourColor],
  );

  const onReserveSelect = useCallback(
    (pieceId: string) => {
      if (!interactive) return;
      setSelection((cur) => (cur?.kind === 'reserve' && cur.pieceId === pieceId ? null : { kind: 'reserve', pieceId }));
    },
    [interactive],
  );

  const onLanded = useCallback(() => setFlight(null), []);

  if (!game) return null;

  const opponentColor = opponentOf(yourColor);
  const you = shown.players.find((p) => p.color === yourColor);
  const opponent = shown.players.find((p) => p.color === opponentColor);
  const hiddenPieceId = flight?.piece.id ?? null;
  const selectedPieceId = selection?.kind === 'reserve' ? selection.pieceId : null;
  const selectedCell = selection?.kind === 'board' ? selection.from : null;

  const outcome: Outcome | null = !finished
    ? null
    : game.status === 'draw'
      ? 'draw'
      : game.winner === yourColor
        ? 'win'
        : 'lose';

  const winnerName = game.winner === yourColor ? 'You' : (opponent?.username ?? 'Your opponent');
  const lastMover = game.lastMove?.color;
  const detail =
    outcome === 'draw'
      ? game.winningLines.length > 1
        ? 'Both players completed a line at the same time.'
        : 'No legal moves remain.'
      : lastMover && lastMover !== game.winner
        ? `${winnerName} won when a hidden piece was uncovered.`
        : `${winnerName} lined up three in a row.`;

  let hint: string;
  if (finished) hint = outcome === 'win' ? 'You won this round!' : outcome === 'lose' ? `${opponent?.username ?? 'Opponent'} won this round.` : "It's a draw.";
  else if (!opponent?.connected) hint = `${opponent?.username ?? 'Opponent'} disconnected — holding their seat…`;
  else if (myTurn) {
    hint = awaiting
      ? 'Placing…'
      : selection
        ? legalCells.size
          ? 'Tap a glowing cell to drop your piece.'
          : 'That piece has nowhere to go — pick another.'
        : game.reserves[yourColor].length
          ? 'Your turn: lift a reserve piece or one of yours on the board.'
          : 'Your reserve is empty — move a piece on the board.';
  } else hint = `${opponent?.username ?? 'Opponent'} is thinking…`;

  const showModal = finished && modalReady && !modalHidden && !!outcome;

  return (
    <motion.main
      className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pt-4 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto w-full max-w-xl">
        <StatusHud room={shown} connection={connection} clockOffset={clockOffset} onLeave={onLeave} />
      </div>

      {connection !== 'connected' && (
        <div className="mx-auto mt-3 flex items-center gap-2 rounded-xl bg-amber/15 px-3 py-2 text-sm text-amber ring-1 ring-amber/30">
          <WifiOff className="h-4 w-4" /> Connection lost — reconnecting. Your seat is held for 20 seconds.
        </div>
      )}

      <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 xl:flex-row xl:items-center xl:gap-8">
        <div className="w-full max-w-[420px] xl:order-1 xl:w-auto">
          <Reserve
            color={opponentColor}
            pieces={game.reserves[opponentColor]}
            owner={opponent?.username ?? 'Opponent'}
            isMine={false}
            scale={boardScale * 0.62}
            selectedPieceId={null}
            hiddenPieceId={hiddenPieceId}
            interactive={false}
            active={game.status === 'playing' && game.turn === opponentColor}
          />
        </div>

        <div className="w-full max-w-[420px] shrink-0 xl:order-2 xl:w-[420px]">
          <Board
            ref={boardRef}
            board={game.board}
            yourColor={yourColor}
            selectedCell={selectedCell}
            legalCells={legalCells}
            winningCells={winningCells}
            lastMoveCell={game.lastMove?.to ?? null}
            hiddenPieceId={hiddenPieceId}
            revealedPieceId={revealedId}
            interactive={interactive}
            onCellClick={onCellClick}
            onScaleChange={setBoardScale}
          />
          <p className="-mt-1 min-h-[1.5rem] text-center text-sm font-medium text-muted" aria-live="polite">
            {hint}
          </p>
        </div>

        <div className="w-full max-w-[420px] xl:order-3 xl:w-auto">
          <Reserve
            color={yourColor}
            pieces={game.reserves[yourColor]}
            owner={you?.username ?? 'You'}
            isMine
            scale={boardScale * 0.82}
            selectedPieceId={selectedPieceId}
            hiddenPieceId={hiddenPieceId}
            interactive={interactive}
            onSelect={onReserveSelect}
            active={myTurn}
          />
        </div>
      </div>

      {flight && <FlyingPiece key={flight.key} flight={flight} onLanded={onLanded} />}

      <AnimatePresence>
        {showModal && outcome && (
          <GameOverModal
            key={`modal-${shown.round}`}
            outcome={outcome}
            yourColor={yourColor}
            players={shown.players}
            detail={detail}
            onToggleRematch={onRematch}
            onLeave={onLeave}
            onHide={() => setModalHidden(true)}
          />
        )}
      </AnimatePresence>

      {finished && modalHidden && (
        <button
          type="button"
          className="btn btn-primary fixed bottom-5 left-1/2 z-[65] -translate-x-1/2 shadow-2xl"
          onClick={() => setModalHidden(false)}
        >
          <Trophy className="h-5 w-5" /> Show results
        </button>
      )}
    </motion.main>
  );
}
