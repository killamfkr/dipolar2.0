const FALLBACK_PREFIX = 'f:';

/** Simple deterministic hash for when crypto.subtle is unavailable (e.g. HTTP). */
function simpleHash(str: string): string {
  let h = 0;
  const s = str;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return Math.abs(h).toString(16) + s.length.toString(16);
}

export async function hashPassword(password: string): Promise<string> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) {
    return FALLBACK_PREFIX + simpleHash(password);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith(FALLBACK_PREFIX)) {
    const expected = FALLBACK_PREFIX + simpleHash(password);
    return expected === storedHash;
  }
  const hash = await hashPassword(password);
  return hash === storedHash;
}
