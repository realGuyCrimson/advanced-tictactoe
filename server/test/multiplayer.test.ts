import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createGameServer, type GameServerInstance } from '../src/app.js';
import { ROOM_CODE_PATTERN, type ClientToServerEvents, type RoomJoinedPayload, type RoomSnapshot, type ServerToClientEvents } from '../src/sockets/protocol.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const GRACE_MS = 300;
let server: GameServerInstance;
let url: string;
const clients: Client[] = [];

function connect(): Promise<Client> {
  const socket: Client = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function next<E extends keyof ServerToClientEvents>(
  socket: Client,
  event: E,
  timeoutMs = 2_000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    (socket.once as (ev: string, cb: (arg: unknown) => void) => void)(event, (arg) => {
      clearTimeout(timer);
      resolve(arg as Parameters<ServerToClientEvents[E]>[0]);
    });
  });
}

async function startMatch() {
  const host = await connect();
  const hosted = next(host, 'ROOM_JOINED');
  host.emit('CREATE_ROOM', { username: 'Alice' });
  const hostJoined = (await hosted) as RoomJoinedPayload;

  const guest = await connect();
  const guestJoined = next(guest, 'ROOM_JOINED');
  const hostUpdate = next(host, 'GAME_STATE_UPDATE');
  guest.emit('JOIN_ROOM', { code: hostJoined.room.code, username: 'Bob' });
  const guestPayload = (await guestJoined) as RoomJoinedPayload;
  await hostUpdate;
  return { host, guest, code: hostJoined.room.code, hostToken: hostJoined.sessionToken, guestToken: guestPayload.sessionToken, guestRoom: guestPayload.room };
}

/** Plays red large 0, blue small 3, red large 4, blue small 5, red medium 8 => red wins. */
async function playRedWin(red: Client, blue: Client, snapshot: RoomSnapshot): Promise<RoomSnapshot> {
  const game = snapshot.game!;
  const id = (color: 'red' | 'blue', size: number, i = 0) =>
    game.reserves[color].filter((p) => p.size === size)[i]!.id;
  const steps: [Client, 'red' | 'blue', number, number, number][] = [
    [red, 'red', 3, 0, 0],
    [blue, 'blue', 1, 0, 3],
    [red, 'red', 3, 1, 4],
    [blue, 'blue', 1, 1, 5],
    [red, 'red', 2, 0, 8],
  ];
  let last: RoomSnapshot = snapshot;
  for (const [socket, color, size, i, to] of steps) {
    const updates = Promise.all([next(red, 'GAME_STATE_UPDATE'), next(blue, 'GAME_STATE_UPDATE')]);
    socket.emit('PLACE_PIECE', { pieceId: id(color, size, i), to });
    last = (await updates)[1] as RoomSnapshot;
  }
  return last;
}

beforeEach(async () => {
  server = createGameServer({ graceMs: GRACE_MS, clientDist: null, allowedOrigins: [/.*/] });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server.close();
});

describe('rooms & matchmaking', () => {
  it('creates a 5-character unambiguous room code and seats the host as red', async () => {
    const host = await connect();
    const joined = next(host, 'ROOM_JOINED');
    host.emit('CREATE_ROOM', { username: '  Alice  ' });
    const { room, sessionToken } = (await joined) as RoomJoinedPayload;
    expect(room.code).toMatch(ROOM_CODE_PATTERN);
    expect(room.code).not.toMatch(/[01OI]/);
    expect(room.phase).toBe('waiting');
    expect(room.yourColor).toBe('red');
    expect(room.players).toEqual([expect.objectContaining({ username: 'Alice', color: 'red', isHost: true, connected: true })]);
    expect(sessionToken).toBeTruthy();
  });

  it('seats the joiner as blue, starts the game with red to move', async () => {
    const { guestRoom } = await startMatch();
    expect(guestRoom.yourColor).toBe('blue');
    expect(guestRoom.phase).toBe('playing');
    expect(guestRoom.game?.turn).toBe('red');
    expect(guestRoom.players.map((p) => p.color)).toEqual(['red', 'blue']);
  });

  it('accepts lowercase codes', async () => {
    const host = await connect();
    const hosted = next(host, 'ROOM_JOINED');
    host.emit('CREATE_ROOM', { username: 'A' });
    const { room } = (await hosted) as RoomJoinedPayload;
    const guest = await connect();
    const joined = next(guest, 'ROOM_JOINED');
    guest.emit('JOIN_ROOM', { code: room.code.toLowerCase(), username: 'B' });
    expect(((await joined) as RoomJoinedPayload).room.code).toBe(room.code);
  });

  it('rejects a third connection with Room Full', async () => {
    const { code } = await startMatch();
    const third = await connect();
    const error = next(third, 'ROOM_ERROR');
    third.emit('JOIN_ROOM', { code, username: 'Eve' });
    expect(await error).toEqual({ code: 'ROOM_FULL', message: expect.stringMatching(/room full/i) });
  });

  it('reports unknown rooms', async () => {
    const socket = await connect();
    const error = next(socket, 'ROOM_ERROR');
    socket.emit('JOIN_ROOM', { code: 'ZZZZZ', username: 'Eve' });
    expect((await error).code).toBe('ROOM_NOT_FOUND');
  });
});

describe('authoritative game loop', () => {
  it('rejects moves from the inactive player without changing state', async () => {
    const { guest, guestRoom } = await startMatch();
    const error = next(guest, 'MOVE_ERROR');
    guest.emit('PLACE_PIECE', { pieceId: guestRoom.game!.reserves.blue[0]!.id, to: 0 });
    expect((await error).message).toMatch(/not your turn/i);
  });

  it('rejects malformed and illegal moves with MOVE_ERROR', async () => {
    const { host } = await startMatch();
    const malformed = next(host, 'MOVE_ERROR');
    host.emit('MOVE_PIECE', { from: 'a', to: 1 } as never);
    expect((await malformed).message).toMatch(/malformed/i);
    const illegal = next(host, 'MOVE_ERROR');
    host.emit('MOVE_PIECE', { from: 0, to: 1 });
    expect((await illegal).message).toMatch(/no piece/i);
  });

  it('broadcasts GAME_STATE_UPDATE to both clients on a valid move', async () => {
    const { host, guest, guestRoom } = await startMatch();
    const hostUpdate = next(host, 'GAME_STATE_UPDATE');
    const guestUpdate = next(guest, 'GAME_STATE_UPDATE');
    host.emit('PLACE_PIECE', { pieceId: guestRoom.game!.reserves.red[0]!.id, to: 4 });
    const [a, b] = (await Promise.all([hostUpdate, guestUpdate])) as RoomSnapshot[];
    expect(a!.game?.turn).toBe('blue');
    expect(b!.game?.board[4]).toHaveLength(1);
    expect(a!.yourColor).toBe('red');
    expect(b!.yourColor).toBe('blue');
  });

  it('ends with a win, then rematch swaps colours once both accept', async () => {
    const { host, guest, guestRoom } = await startMatch();
    const finished = await playRedWin(host, guest, guestRoom);
    expect(finished.phase).toBe('finished');
    expect(finished.game?.winner).toBe('red');

    const afterFirst = Promise.all([next(host, 'GAME_STATE_UPDATE'), next(guest, 'GAME_STATE_UPDATE')]);
    host.emit('SET_REMATCH', { wants: true });
    const pending = (await afterFirst)[1] as RoomSnapshot;
    expect(pending.phase).toBe('finished');
    expect(pending.players.find((p) => p.username === 'Alice')?.wantsRematch).toBe(true);

    const hostRound2 = next(host, 'GAME_STATE_UPDATE');
    const guestRound2 = next(guest, 'GAME_STATE_UPDATE');
    guest.emit('SET_REMATCH', { wants: true });
    const [h, g] = (await Promise.all([hostRound2, guestRound2])) as RoomSnapshot[];
    expect(h!.round).toBe(2);
    expect(h!.phase).toBe('playing');
    expect(h!.yourColor).toBe('blue');
    expect(g!.yourColor).toBe('red');
    expect(g!.game?.turn).toBe('red');
    expect(g!.game?.moveCount).toBe(0);
    expect(g!.game?.board.every((s) => s.length === 0)).toBe(true);
    expect(g!.players.every((p) => !p.wantsRematch)).toBe(true);

    // The new red (Bob) moves first in round 2.
    const update = next(host, 'GAME_STATE_UPDATE');
    guest.emit('PLACE_PIECE', { pieceId: g!.game!.reserves.red[0]!.id, to: 0 });
    expect(((await update) as RoomSnapshot).game?.turn).toBe('blue');
  });
});

describe('connection lifecycle', () => {
  it('lets a player reclaim their seat with the session token within the grace period', async () => {
    const { host, guest, code, guestToken } = await startMatch();
    const notice = next(host, 'GAME_STATE_UPDATE');
    guest.disconnect();
    const during = (await notice) as RoomSnapshot;
    const bob = during.players.find((p) => p.username === 'Bob')!;
    expect(bob.connected).toBe(false);
    expect(bob.graceExpiresAt).toBeGreaterThan(Date.now());

    const back = await connect();
    const rejoined = next(back, 'ROOM_JOINED');
    const hostSees = next(host, 'GAME_STATE_UPDATE');
    back.emit('REJOIN_ROOM', { code, sessionToken: guestToken });
    const payload = (await rejoined) as RoomJoinedPayload;
    expect(payload.room.yourColor).toBe('blue');
    expect(((await hostSees) as RoomSnapshot).players.every((p) => p.connected)).toBe(true);

    // The room survives past the original deadline.
    await new Promise((r) => setTimeout(r, GRACE_MS + 100));
    expect(server.rooms.hasRoom(code)).toBe(true);
  });

  it('closes the room when the grace period expires', async () => {
    const { host, guest, code } = await startMatch();
    const closed = next(host, 'ROOM_CLOSED');
    guest.disconnect();
    expect((await closed).reason).toBe('timeout');
    expect(server.rooms.hasRoom(code)).toBe(false);
  });

  it('rejects stale session tokens', async () => {
    const socket = await connect();
    const error = next(socket, 'ROOM_ERROR');
    socket.emit('REJOIN_ROOM', { code: 'ABCDE', sessionToken: 'nope' });
    expect((await error).code).toBe('REJOIN_FAILED');
  });

  it('leaving tears the room down and returns both players to the lobby', async () => {
    const { host, guest, code } = await startMatch();
    const hostClosed = next(host, 'ROOM_CLOSED');
    const guestClosed = next(guest, 'ROOM_CLOSED');
    guest.emit('LEAVE_ROOM');
    const [h, g] = await Promise.all([hostClosed, guestClosed]);
    expect(h.reason).toBe('left');
    expect(h.message).toMatch(/Bob left/);
    expect(g.message).toMatch(/You left/);
    expect(server.rooms.hasRoom(code)).toBe(false);
  });

  it('a duplicated tab with the same token takes over the seat', async () => {
    const { host, code, hostToken } = await startMatch();
    const replaced = next(host, 'ROOM_CLOSED');
    const twin = await connect();
    const joined = next(twin, 'ROOM_JOINED');
    twin.emit('JOIN_ROOM', { code, username: 'Alice', sessionToken: hostToken });
    expect(((await joined) as RoomJoinedPayload).room.yourColor).toBe('red');
    expect((await replaced).reason).toBe('replaced');
    expect(server.rooms.hasRoom(code)).toBe(true);
  });
});
