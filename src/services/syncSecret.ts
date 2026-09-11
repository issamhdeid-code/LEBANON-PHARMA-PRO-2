const SECRET_STORAGE_KEY = 'pharmalebanon_sync_secret_v1';

let cachedSecret: string | null = null;

export function getSyncSecret(): string | null {
  if (cachedSecret !== null) return cachedSecret;
  try {
    cachedSecret = localStorage.getItem(SECRET_STORAGE_KEY);
  } catch {
    cachedSecret = null;
  }
  return cachedSecret;
}

export function setSyncSecret(secret: string): void {
  cachedSecret = secret;
  try {
    localStorage.setItem(SECRET_STORAGE_KEY, secret);
  } catch { /* quota — non-critical */ }
}

export function clearSyncSecret(): void {
  cachedSecret = null;
  try {
    localStorage.removeItem(SECRET_STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Ensure a sync secret exists and the local server knows it.
 * On fresh install: provisions a server-generated secret (first-time bootstrap).
 * On subsequent boots: re-pushes the stored secret so the server is always in sync.
 * Returns the active secret, or null if the push failed on first-run.
 */
export async function pushSyncSecretToServer(): Promise<string | null> {
  const current = getSyncSecret();
  try {
    const res = await fetch('/api/sync/secret', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(current ? { 'X-Sync-Secret': current } : {}),
      },
      body: JSON.stringify({ secret: current || '' }),
    });
    if (!res.ok) return current;
    const body = await res.json().catch(() => null);
    const secret: string | undefined = body?.secret;
    if (!secret || typeof secret !== 'string') return current;
    if (secret !== current) setSyncSecret(secret);
    return secret;
  } catch {
    return current;
  }
}

/**
 * Generate a new random secret (32 hex chars) and persist it.
 * Returns the new secret. Use this when the user clicks "Regenerate" in Settings.
 */
export function regenerateSyncSecret(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  setSyncSecret(hex);
  return hex;
}
