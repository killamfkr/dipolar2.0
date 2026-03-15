/**
 * Client API for Dipolar Server (Emby-style).
 * When app is in "server mode", catalog and stream URLs come from here.
 */

const SERVER_URL_KEY = 'streamio-server-url';

export function getServerBaseUrl(): string {
  try {
    const u = localStorage.getItem(SERVER_URL_KEY);
    const stored = (u ?? '').trim().replace(/\/+$/, '');
    if (stored) return stored;
    // When served from Docker/same host (e.g. http://UNRAID_IP/), use same origin so /api works
    if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost:5173'))
      return window.location.origin;
    return '';
  } catch {
    return '';
  }
}

export function setServerBaseUrl(url: string): void {
  const v = (url ?? '').trim().replace(/\/+$/, '');
  try {
    if (v) localStorage.setItem(SERVER_URL_KEY, v);
    else localStorage.removeItem(SERVER_URL_KEY);
  } catch {
    /* ignore */
  }
}

export const SERVER_STREAM_PREFIX = 'server://';

export function isServerStreamUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(SERVER_STREAM_PREFIX);
}

export function parseServerStreamUrl(url: string): { type: string; id: string } | null {
  if (!isServerStreamUrl(url)) return null;
  const rest = url.slice(SERVER_STREAM_PREFIX.length);
  const [type, id] = rest.split('/');
  return type && id ? { type, id } : null;
}

export async function fetchCatalog(baseUrl: string): Promise<{
  channels: Array<{ id: string; name: string; logo?: string; group?: string; epgId?: string; url?: string }>;
  epg: { channels: Array<{ id: string; displayName?: string }> };
  vodMovies: unknown[];
  vodSeries: unknown[];
  vodFromM3u: Array<{ id: string; name: string; url: string; group?: string; logo?: string }>;
}> {
  const res = await fetch(`${baseUrl}/api/catalog`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Server: ${res.status}`);
  const data = await res.json();
  const channels = (data.channels || []).map((ch: { id: string; name: string; logo?: string; group?: string; epgId?: string }) => ({
    ...ch,
    url: `${SERVER_STREAM_PREFIX}live/${ch.id}`,
  }));
  return {
    channels,
    epg: data.epg || { channels: [] },
    vodMovies: data.vodMovies || [],
    vodSeries: data.vodSeries || [],
    vodFromM3u: (data.vodFromM3u || []).map((v: { id: string; name: string; url: string; group?: string; logo?: string }) => ({
      ...v,
      url: `${SERVER_STREAM_PREFIX}vod/m3u/${v.id}`,
    })),
  };
}

/** Resolve server:// path to real stream URL via server API */
export async function resolveStreamUrl(baseUrl: string, serverUrl: string): Promise<string> {
  if (!isServerStreamUrl(serverUrl)) return serverUrl;
  const path = serverUrl.slice(SERVER_STREAM_PREFIX.length);
  if (!path) return serverUrl;
  const res = await fetch(`${baseUrl}/api/stream/${path}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Stream: ${res.status}`);
  const data = await res.json();
  return data.url || serverUrl;
}
