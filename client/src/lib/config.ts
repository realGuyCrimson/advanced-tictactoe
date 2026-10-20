import { ROOM_CODE_PATTERN } from '@shared/sockets/protocol';

const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();

/**
 * Socket.IO server URL. `undefined` means "same origin", which works for the
 * Vite dev proxy and for the all-in-one deployment where Express serves the client.
 */
export const SERVER_URL: string | undefined = configured ? configured.replace(/\/+$/, '') : undefined;

/** Extracts a room code from a path such as `/ABCDE`. */
export function roomCodeFromPath(pathname: string): string | null {
  const code = pathname.replace(/^\/+|\/+$/g, '').toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/${code}`;
}
