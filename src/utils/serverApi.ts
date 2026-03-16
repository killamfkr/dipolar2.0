/**
 * Client API for Dipolar Server (Emby-style).
 * When app is in "server mode", catalog and stream URLs come from here.
 */

const SERVER_URL_KEY = 'streamio-server-url';
const SERVER_URL_DISABLED = '__DISABLED__';

export function getServerBaseUrl(): string {
  try {
    const raw = localStorage.getItem(SERVER_URL_KEY);
    // User explicitly disabled server mode
    if (raw === SERVER_URL_DISABLED) return '';
    const stored = (raw ?? '').trim().replace(/\/+$/, '');
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
    if (v) {
      localStorage.setItem(SERVER_URL_KEY, v);
    } else {
      // Store explicit "disabled" sentinel so we don't fall back to window.location.origin
      localStorage.setItem(SERVER_URL_KEY, SERVER_URL_DISABLED);
    }
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
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('Server URL not set');
  const res = await fetch(`${base}/api/stream/${path}`, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && typeof data.error === 'string') ? data.error : `Stream: ${res.status}`;
    throw new Error(msg);
  }
  const resolved = data?.url;
  if (typeof resolved !== 'string' || !resolved) throw new Error('Invalid stream response');
  return resolved;
}

/** Fetch series episodes from server (for server mode when client has no xtreamConfig). */
export async function fetchSeriesEpisodesFromServer(
  baseUrl: string,
  seriesId: number | string
): Promise<Array<{ id: string | number; episode_num: number; title: string; container_extension?: string; info?: { movie_image?: string; plot?: string }; custom_sid?: string | null; [key: string]: unknown }>> {
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('Server URL not set');
  const id = String(seriesId);
  const res = await fetch(`${base}/api/series/${encodeURIComponent(id)}/episodes`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Series: ${res.status}`);
  const data = await res.json();
  const episodes = data?.episodes;
  return Array.isArray(episodes) ? episodes : [];
}
