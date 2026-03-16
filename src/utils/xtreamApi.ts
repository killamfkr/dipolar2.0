import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { XtreamConfig, SeriesInfo, VodEpisode, VodMovie, VodSeries } from '../types/xtream';

import { fetchTextNativeOrWeb, M3U_TIMEOUT_MS } from './nativeFetch';

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : s + '/';
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

export function buildGetUrl(config: XtreamConfig, output: 'ts' | 'hls' = 'ts'): string {
  const base = stripTrailingSlash(config.baseUrl);
  return `${base}/get.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}&type=m3u_plus&output=${output}`;
}

export function buildXmltvUrl(config: XtreamConfig): string {
  const base = stripTrailingSlash(config.baseUrl);
  return `${base}/xmltv.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`;
}

export function buildPlayerApiUrl(
  config: XtreamConfig,
  action: string,
  extra: Record<string, string> = {}
): string {
  const base = stripTrailingSlash(config.baseUrl);
  const params = new URLSearchParams({
    username: config.username,
    password: config.password,
    action,
    ...extra,
  });
  return `${base}/player_api.php?${params.toString()}`;
}

export function buildMovieStreamUrl(
  config: XtreamConfig,
  streamId: number,
  extension: string
): string {
  if (config == null || typeof config.baseUrl !== 'string' || !config.baseUrl.trim()) return '';
  const id = Number(streamId);
  if (!Number.isFinite(id) || id < 0) return '';
  const base = ensureTrailingSlash(config.baseUrl.trim());
  const user = encodeURIComponent(typeof config.username === 'string' ? config.username : '');
  const pass = encodeURIComponent(typeof config.password === 'string' ? config.password : '');
  const ext = (typeof extension === 'string' && extension) ? extension.replace(/^\./, '') : 'mp4';
  return `${base}movie/${user}/${pass}/${id}.${ext}`;
}

export function buildEpisodeStreamUrl(
  config: XtreamConfig,
  episodeId: string,
  extension: string
): string {
  if (config == null || typeof config.baseUrl !== 'string' || !config.baseUrl.trim()) return '';
  const id = episodeId != null ? String(episodeId).trim() : '';
  if (!id) return '';
  const base = ensureTrailingSlash(config.baseUrl.trim());
  const user = encodeURIComponent(typeof config.username === 'string' ? config.username : '');
  const pass = encodeURIComponent(typeof config.password === 'string' ? config.password : '');
  const ext = (typeof extension === 'string' && extension) ? extension.replace(/^\./, '') : 'mp4';
  return `${base}series/${user}/${pass}/${id}.${ext}`;
}

/** Resolve relative icon/cover URLs from Xtream API against the base URL so box art loads. */
export function resolveXtreamIcon(baseUrl: string | undefined, iconUrl: string | undefined): string | undefined {
  if (!iconUrl?.trim()) return undefined;
  const trimmed = iconUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (!baseUrl?.trim()) return trimmed;
  try {
    const withScheme = baseUrl.trim().startsWith('http') ? baseUrl.trim() : `http://${baseUrl.trim()}`;
    const origin = new URL(withScheme).origin;
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed.replace(/^\/+/, '')}`;
    return new URL(path, `${origin}/`).href;
  } catch {
    return trimmed;
  }
}

/** Data URI for a small placeholder when poster fails to load (avoids broken image icon). */
export const VOD_POSTER_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='240' viewBox='0 0 160 240'%3E%3Crect fill='%23333' width='160' height='240'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48'%3E🎬%3C/text%3E%3C/svg%3E";

export async function fetchM3uFromXtream(config: XtreamConfig): Promise<string> {
  const url = buildGetUrl(config);
  return fetchTextNativeOrWeb(url, { timeoutMs: M3U_TIMEOUT_MS });
}

export async function fetchEpgFromXtream(config: XtreamConfig): Promise<string> {
  const url = buildXmltvUrl(config);
  return fetchTextNativeOrWeb(url);
}

async function fetchJsonFromXtream<T>(url: string): Promise<T> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, responseType: 'json' });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    return res.data as T;
  }
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

function normalizeMovie(m: VodMovie): VodMovie {
  const id = m.stream_id != null ? Number(m.stream_id) : NaN;
  return Number.isFinite(id) && id >= 0 ? { ...m, stream_id: id } : m;
}

function normalizeSeries(s: VodSeries): VodSeries {
  const id = s.series_id != null ? Number(s.series_id) : NaN;
  return Number.isFinite(id) && id >= 0 ? { ...s, series_id: id } : s;
}

export async function fetchVodStreams(config: XtreamConfig): Promise<VodMovie[]> {
  const url = buildPlayerApiUrl(config, 'get_vod_streams');
  const data = await fetchJsonFromXtream<{ movies?: VodMovie[] } | VodMovie[]>(url);
  const list = Array.isArray(data) ? data : data.movies || [];
  return list.map(normalizeMovie).filter((m) => Number.isFinite(m.stream_id) && m.stream_id >= 0);
}

export async function fetchSeries(config: XtreamConfig): Promise<VodSeries[]> {
  const url = buildPlayerApiUrl(config, 'get_series');
  const data = await fetchJsonFromXtream<{ series?: VodSeries[] } | VodSeries[]>(url);
  const list = Array.isArray(data) ? data : (data.series ?? []);
  return list.map(normalizeSeries).filter((s) => Number.isFinite(s.series_id) && s.series_id >= 0);
}

export async function fetchSeriesInfo(
  config: XtreamConfig,
  seriesId: number
): Promise<SeriesInfo> {
  const url = buildPlayerApiUrl(config, 'get_series_info', {
    series_id: String(seriesId),
  });
  return fetchJsonFromXtream<SeriesInfo>(url);
}

export function flattenSeriesEpisodes(info: SeriesInfo): VodEpisode[] {
  const episodes = info.episodes;
  if (!episodes) return [];
  if (Array.isArray(episodes)) {
    return [...episodes].sort((a, b) => (a.episode_num || 0) - (b.episode_num || 0));
  }
  const list: VodEpisode[] = [];
  for (const seasonEpisodes of Object.values(episodes)) {
    if (Array.isArray(seasonEpisodes)) list.push(...seasonEpisodes);
  }
  return list.sort((a, b) => (a.episode_num || 0) - (b.episode_num || 0));
}
