/**
 * Fetch text: on native uses CapacitorHttp directly (reliable, no CORS); on web uses fetch().
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

const DEFAULT_TIMEOUT_MS = 45_000;
/**
 * Allow enough time for very large/slow Xtream playlists.
 * Some providers take a couple of minutes to return the full M3U.
 */
export const M3U_TIMEOUT_MS = 300_000;

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    if ('message' in e && typeof (e as { message: unknown }).message === 'string')
      return (e as { message: string }).message;
    if ('error' in e && typeof (e as { error: unknown }).error === 'string')
      return (e as { error: string }).error;
  }
  return String(e ?? 'Unknown error');
}

export interface FetchTextOptions {
  timeoutMs?: number;
}

export async function fetchTextNativeOrWeb(
  url: string,
  options?: FetchTextOptions
): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('URL is empty.');
  let targetUrl = trimmed;
  try {
    new URL(trimmed);
  } catch {
    targetUrl = trimmed.startsWith('http') ? trimmed : `http://${trimmed}`;
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (Capacitor.isNativePlatform()) {
    const timeoutReject = () => new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Check the URL and network.')), timeoutMs);
    });
    const doNativeFetch = () => {
      const p = CapacitorHttp.get({
        url: targetUrl,
        responseType: 'text',
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      }).then((res) => {
        if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
        const data = res.data;
        const text = typeof data === 'string' ? data : data != null ? String(data) : '';
        if (!text && res.status === 200) throw new Error('Server returned empty response.');
        return text;
      });
      return Promise.race([p, timeoutReject()]);
    };
    const doWebFetch = () => {
      const controller = new AbortController();
      const t = new Promise<never>((_, reject) => {
        setTimeout(() => { controller.abort(); reject(new Error('Request timed out.')); }, timeoutMs);
      });
      const f = fetch(targetUrl, { signal: controller.signal, mode: 'cors' })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
        .then((text) => { if (!text) throw new Error('Server returned empty response.'); return text; });
      return Promise.race([f, t]);
    };
    try {
      return await doNativeFetch();
    } catch (firstErr) {
      const firstMsg = getErrorMessage(firstErr);
      if (!/timeout|timed out/i.test(firstMsg)) {
        if (/cleartext|cleartexttraffic|ssl|certificate/i.test(firstMsg))
          throw new Error('Connection blocked. Try HTTPS or check network security.');
        if (/failed to fetch|network error|unable to resolve host/i.test(firstMsg))
          throw new Error('Network error. Check URL and internet connection.');
        throw new Error(firstMsg || 'Request failed.');
      }
      try {
        return await doWebFetch();
      } catch (secondErr) {
        const msg = getErrorMessage(secondErr);
        if (/timeout|timed out/i.test(msg))
          throw new Error('Request timed out. Check the URL and network.');
        throw new Error(msg || 'Request failed.');
      }
    }
  }

  const controller = new AbortController();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error('Request timed out. Check the URL and network.'));
    }, timeoutMs);
  });

  const fetchPromise = (async () => {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      mode: 'cors',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const text = await res.text();
    if (!text && res.ok) throw new Error('Server returned empty response.');
    return text;
  })();

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
    const msg = getErrorMessage(e);
    if (/timeout|timed out/i.test(msg))
      throw new Error('Request timed out. Check the URL and network.');
    if (/cleartext|cleartexttraffic|ssl|certificate/i.test(msg))
      throw new Error('Connection blocked. Try HTTPS or check network security.');
    if (/failed to fetch|network error|unable to resolve host/i.test(msg))
      throw new Error('Network error. Check URL and internet connection.');
    throw new Error(msg || 'Request failed.');
  }
}
