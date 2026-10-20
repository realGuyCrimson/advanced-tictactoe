const USERNAME_KEY = 'ttpadv:username';
const SESSION_KEY = 'ttpadv:session';

export interface StoredSession {
  code: string;
  sessionToken: string;
}

// Storage can throw in private windows or when site data is blocked; the game
// must keep working without it.

export function loadUsername(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveUsername(name: string): void {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {
    /* ignore */
  }
}

/** The reconnection token lives in sessionStorage so a refresh keeps the seat. */
export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.code === 'string' && typeof parsed.sessionToken === 'string'
      ? { code: parsed.code, sessionToken: parsed.sessionToken }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
