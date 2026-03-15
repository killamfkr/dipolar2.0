import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from 'react';
import type { EpgData } from '../types/epg';
import type { IptvChannel, M3uVodItem } from '../types/iptv';
import type { VodMovie, VodSeries, XtreamConfig } from '../types/xtream';
import { parseM3u } from '../utils/m3uParser';
import { parseXmltv } from '../utils/epgParser';
import {
  fetchEpgFromXtream,
  fetchM3uFromXtream,
  fetchSeries,
  fetchVodStreams,
} from '../utils/xtreamApi';
import { useAuth } from './AuthContext';
import { fetchTextNativeOrWeb, M3U_TIMEOUT_MS } from '../utils/nativeFetch';
import { SAMPLE_XMLTV } from '../data/sampleEpg';
import {
  getServerBaseUrl,
  setServerBaseUrl as persistServerBaseUrl,
  fetchCatalog as fetchServerCatalog,
  isServerStreamUrl,
  resolveStreamUrl as resolveServerStreamUrl,
} from '../utils/serverApi';

// Inline sample used when "Load sample" is clicked (avoids any import/bundling issues)
const INLINE_SAMPLE_M3U =
  '#EXTM3U\n' +
  '#EXTINF:-1 tvg-id="bbc-one" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/e/eb/BBC_one_logo_2022.svg" group-title="Entertainment",BBC One\n' +
  'https://example.com/streams/bbc1.m3u8\n' +
  '#EXTINF:-1 tvg-id="bbc-two" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/3/3b/BBC_Two_2022_Ident.svg" group-title="Entertainment",BBC Two\n' +
  'https://example.com/streams/bbc2.m3u8\n' +
  '#EXTINF:-1 tvg-id="sky-news" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/2/2e/Sky_News_2023_Logo.svg" group-title="News",Sky News\n' +
  'https://example.com/streams/skynews.m3u8\n' +
  '#EXTINF:-1 tvg-id="sport-hd" tvg-logo="" group-title="Sports",Sport HD\n' +
  'https://example.com/streams/sport.m3u8\n' +
  '#EXTINF:-1 tvg-id="movie-channel" group-title="Movies",Movies 24/7\n' +
  'https://example.com/streams/movies.m3u8';

interface PlaybackState {
  url: string;
  title: string;
  isLive?: boolean;
  initialTime?: number;
}

function getContinueWatchingKey(userId: string | null): string {
  return userId ? `streamio-continue-watching-${userId}` : 'streamio-continue-watching';
}

function getFavoritesKey(userId: string | null): string {
  return userId ? `streamio-favorites-${userId}` : 'streamio-favorites';
}

const PREFER_EXTERNAL_PLAYER_KEY = 'streamio-prefer-external-player';
const EXTERNAL_PLAYER_MODE_KEY = 'streamio-external-player-mode';

export type ExternalPlayerMode = 'chooser' | 'browser';

function loadPreferExternalPlayer(): boolean {
  try {
    return localStorage.getItem(PREFER_EXTERNAL_PLAYER_KEY) === '1';
  } catch {
    return false;
  }
}

function loadExternalPlayerMode(): ExternalPlayerMode {
  try {
    const v = localStorage.getItem(EXTERNAL_PLAYER_MODE_KEY);
    return v === 'browser' ? 'browser' : 'chooser';
  } catch {
    return 'chooser';
  }
}

export interface Favorites {
  channelIds: string[];
  movieIds: number[];
  seriesIds: number[];
  m3uVodIds: string[];
}

const PERSISTED_DATA_KEY = 'streamio-persisted-data';

interface PersistedData {
  channels: IptvChannel[];
  epg: EpgData;
  vodMovies: VodMovie[];
  vodSeries: VodSeries[];
  vodFromM3u: M3uVodItem[];
  m3uUrl: string;
  epgUrl: string;
  xtreamConfig: XtreamConfig | null;
}

function reviveEpg(epg: PersistedData['epg']): EpgData {
  if (!epg?.channels) return { channels: [] };
  return {
    channels: epg.channels.map((ch) => ({
      ...ch,
      programs: (ch.programs || []).map((p) => ({
        ...p,
        start: p.start instanceof Date ? p.start : new Date(p.start as unknown as string),
        end: p.end instanceof Date ? p.end : new Date(p.end as unknown as string),
      })),
    })),
  };
}

function normalizeVodMovie(raw: unknown): VodMovie | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const streamId = m.stream_id;
  if (streamId == null || (typeof streamId !== 'number' && typeof streamId !== 'string')) return null;
  const id = Number(streamId);
  if (!Number.isFinite(id) || id < 0) return null;
  return { ...m, stream_id: id } as VodMovie;
}

function normalizeVodSeries(raw: unknown): VodSeries | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const seriesId = s.series_id;
  if (seriesId == null || (typeof seriesId !== 'number' && typeof seriesId !== 'string')) return null;
  const id = Number(seriesId);
  if (!Number.isFinite(id) || id < 0) return null;
  return { ...s, series_id: id } as VodSeries;
}

function parseAndValidatePersisted(parsed: unknown): PersistedData {
  if (!parsed || typeof parsed !== 'object') return getEmptyPersisted();
  const p = parsed as Record<string, unknown>;
  const rawMovies = Array.isArray(p.vodMovies) ? p.vodMovies : [];
  const rawSeries = Array.isArray(p.vodSeries) ? p.vodSeries : [];
  const vodMovies: VodMovie[] = [];
  for (const raw of rawMovies) {
    const m = normalizeVodMovie(raw);
    if (m) vodMovies.push(m);
  }
  const vodSeries: VodSeries[] = [];
  for (const raw of rawSeries) {
    const s = normalizeVodSeries(raw);
    if (s) vodSeries.push(s);
  }
  return {
    channels: Array.isArray(p.channels) ? (p.channels as IptvChannel[]) : [],
    epg: reviveEpg(p.epg as PersistedData['epg']),
    vodMovies,
    vodSeries,
    vodFromM3u: Array.isArray(p.vodFromM3u) ? (p.vodFromM3u as M3uVodItem[]) : [],
    m3uUrl: typeof p.m3uUrl === 'string' ? p.m3uUrl : '',
    epgUrl: typeof p.epgUrl === 'string' ? p.epgUrl : '',
    xtreamConfig:
      p.xtreamConfig &&
      typeof p.xtreamConfig === 'object' &&
      typeof (p.xtreamConfig as XtreamConfig).baseUrl === 'string'
        ? (p.xtreamConfig as XtreamConfig)
        : null,
  };
}

function loadPersistedData(): PersistedData {
  try {
    const raw = localStorage.getItem(PERSISTED_DATA_KEY);
    if (!raw) return getEmptyPersisted();
    return parseAndValidatePersisted(JSON.parse(raw));
  } catch {
    return getEmptyPersisted();
  }
}

function getEmptyPersisted(): PersistedData {
  return {
    channels: [],
    epg: { channels: [] },
    vodMovies: [],
    vodSeries: [],
    vodFromM3u: [],
    m3uUrl: '',
    epgUrl: '',
    xtreamConfig: null,
  };
}

function savePersistedData(data: PersistedData) {
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(PERSISTED_DATA_KEY, json);
  } catch {
    /* ignore */
  }
  // On native, also persist to Capacitor Preferences (survives app close)
  import('@capacitor/core').then(({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: PERSISTED_DATA_KEY, value: json }).catch(() => {});
    });
  });
}

export interface ContinueWatchingItem {
  id: string;
  title: string;
  url: string;
  progress: number;
  duration: number;
  poster?: string;
}

export interface LoadResult {
  success: boolean;
  message: string;
  count?: number;
}

export interface VodLoadResult {
  success: boolean;
  message: string;
  movieCount?: number;
  seriesCount?: number;
}

function loadContinueWatching(userId: string | null): ContinueWatchingItem[] {
  try {
    const key = getContinueWatchingKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveContinueWatching(items: ContinueWatchingItem[], userId: string | null) {
  try {
    localStorage.setItem(getContinueWatchingKey(userId), JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function loadFavorites(userId: string | null): Favorites {
  try {
    const raw = localStorage.getItem(getFavoritesKey(userId));
    if (!raw) return { channelIds: [], movieIds: [], seriesIds: [], m3uVodIds: [] };
    const parsed = JSON.parse(raw);
    return {
      channelIds: Array.isArray(parsed.channelIds) ? parsed.channelIds : [],
      movieIds: Array.isArray(parsed.movieIds) ? parsed.movieIds : [],
      seriesIds: Array.isArray(parsed.seriesIds) ? parsed.seriesIds : [],
      m3uVodIds: Array.isArray(parsed.m3uVodIds) ? parsed.m3uVodIds : [],
    };
  } catch {
    return { channelIds: [], movieIds: [], seriesIds: [], m3uVodIds: [] };
  }
}

function saveFavorites(fav: Favorites, userId: string | null) {
  try {
    localStorage.setItem(getFavoritesKey(userId), JSON.stringify(fav));
  } catch {
    /* ignore */
  }
}

interface AppState {
  channels: IptvChannel[];
  epg: EpgData;
  playback: PlaybackState | null;
  m3uUrl: string;
  epgUrl: string;
  lastM3uResult: LoadResult | null;
  lastEpgResult: LoadResult | null;
  xtreamConfig: XtreamConfig | null;
  vodMovies: VodMovie[];
  vodSeries: VodSeries[];
  vodFromM3u: M3uVodItem[];
  lastXtreamResult: LoadResult | null;
  lastVodResult: VodLoadResult | null;
  continueWatching: ContinueWatchingItem[];
  favorites: Favorites;
}

interface AppContextValue extends AppState {
  setPlayback: (state: PlaybackState | null) => void;
  reportPlaybackProgress: (url: string, progress: number, duration: number, title?: string, poster?: string) => void;
  removeFromContinueWatching: (id: string) => void;
  toggleFavoriteChannel: (id: string) => void;
  toggleFavoriteMovie: (streamId: number) => void;
  toggleFavoriteSeries: (seriesId: number) => void;
  toggleFavoriteM3uVod: (id: string) => void;
  isFavoriteChannel: (id: string) => boolean;
  isFavoriteMovie: (streamId: number) => boolean;
  isFavoriteSeries: (seriesId: number) => boolean;
  isFavoriteM3uVod: (id: string) => boolean;
  loadM3u: (content: string) => LoadResult;
  loadM3uFromUrl: (url: string) => Promise<LoadResult>;
  loadEpg: (xml: string) => LoadResult;
  loadEpgFromUrl: (url: string) => Promise<LoadResult>;
  loadSampleData: () => void;
  clearLoadResults: () => void;
  clearPersistedData: () => void;
  setXtreamConfig: (config: XtreamConfig | null) => void;
  loadFromXtream: (config: XtreamConfig) => Promise<LoadResult>;
  loadVodFromXtream: (config: XtreamConfig) => Promise<VodLoadResult>;
  preferExternalPlayer: boolean;
  setPreferExternalPlayer: (value: boolean) => void;
  externalPlayerMode: ExternalPlayerMode;
  setExternalPlayerMode: (value: ExternalPlayerMode) => void;
  playOrOpenExternally: (state: PlaybackState) => void;
  serverBaseUrl: string;
  setServerBaseUrl: (url: string) => void;
  refreshServerCatalog: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  const empty = getEmptyPersisted();
  const [channels, setChannels] = useState<IptvChannel[]>(() => empty.channels);
  const [epg, setEpg] = useState<EpgData>(() => empty.epg);
  const [playback, setPlaybackState] = useState<PlaybackState | null>(null);
  const [m3uUrl, setM3uUrl] = useState(() => empty.m3uUrl);
  const [epgUrl, setEpgUrl] = useState(() => empty.epgUrl);
  const [lastM3uResult, setLastM3uResult] = useState<LoadResult | null>(null);
  const [lastEpgResult, setLastEpgResult] = useState<LoadResult | null>(null);
  const [xtreamConfig, setXtreamConfigState] = useState<XtreamConfig | null>(() => empty.xtreamConfig);
  const [vodMovies, setVodMovies] = useState<VodMovie[]>(() => empty.vodMovies);
  const [vodSeries, setVodSeries] = useState<VodSeries[]>(() => empty.vodSeries);
  const [vodFromM3u, setVodFromM3u] = useState<M3uVodItem[]>(() => empty.vodFromM3u);
  const [lastXtreamResult, setLastXtreamResult] = useState<LoadResult | null>(null);
  const [lastVodResult, setLastVodResult] = useState<VodLoadResult | null>(null);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>(() => loadContinueWatching(userId));
  const [favorites, setFavorites] = useState<Favorites>(() => loadFavorites(userId));
  const [preferExternalPlayer, setPreferExternalPlayerState] = useState(loadPreferExternalPlayer);
  const [externalPlayerMode, setExternalPlayerModeState] = useState(loadExternalPlayerMode);
  const [serverBaseUrl, setServerBaseUrlState] = useState(getServerBaseUrl);
  const catalogHydratedRef = useRef(false);

  useEffect(() => {
    setContinueWatching(loadContinueWatching(userId));
  }, [userId]);

  useEffect(() => {
    setFavorites(loadFavorites(userId));
  }, [userId]);

  useEffect(() => {
    saveFavorites(favorites, userId);
  }, [favorites, userId]);

  // When server URL is set, fetch catalog from Dipolar Server (Emby-style)
  const refreshServerCatalog = useCallback(async () => {
    const base = getServerBaseUrl();
    if (!base) return;
    try {
      const data = await fetchServerCatalog(base);
      setChannels((data.channels || []) as IptvChannel[]);
      setEpg({
        channels: (data.epg?.channels || []).map((ch: { id: string; displayName?: string }) => ({
          id: ch.id,
          displayName: ch.displayName ?? ch.id,
          programs: [],
        })),
      });
      setVodMovies((data.vodMovies || []) as VodMovie[]);
      setVodSeries((data.vodSeries || []) as VodSeries[]);
      setVodFromM3u(data.vodFromM3u || []);
      catalogHydratedRef.current = true;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!serverBaseUrl) return;
    refreshServerCatalog();
  }, [serverBaseUrl]);

  const setServerBaseUrl = useCallback((url: string) => {
    const v = (url ?? '').trim().replace(/\/+$/, '');
    persistServerBaseUrl(v);
    setServerBaseUrlState(v);
    if (v) refreshServerCatalog();
  }, [refreshServerCatalog]);

  // Deferred hydration: load persisted data after first paint to avoid blocking the UI
  useEffect(() => {
    let cancelled = false;
    const runAfterPaint = (fn: () => void) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setTimeout(fn, 0);
        });
      } else {
        setTimeout(fn, 0);
      }
    };

    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        import('@capacitor/preferences').then(({ Preferences }) => {
          Preferences.get({ key: PREFER_EXTERNAL_PLAYER_KEY }).then(({ value }) => {
            if (!cancelled && value === '1') setPreferExternalPlayerState(true);
          });
          Preferences.get({ key: EXTERNAL_PLAYER_MODE_KEY }).then(({ value }) => {
            if (!cancelled && value === 'browser') setExternalPlayerModeState('browser');
          });
          Preferences.get({ key: PERSISTED_DATA_KEY }).then(({ value }) => {
            if (cancelled) return;
            runAfterPaint(() => {
              if (cancelled) return;
              if (value) {
                try {
                  const data = parseAndValidatePersisted(JSON.parse(value));
                  setChannels(data.channels);
                  setEpg(data.epg);
                  setM3uUrl(data.m3uUrl);
                  setEpgUrl(data.epgUrl);
                  setXtreamConfigState(data.xtreamConfig);
                  setVodMovies(Array.isArray(data.vodMovies) ? data.vodMovies.slice(0, 100) : []);
                  setVodSeries(Array.isArray(data.vodSeries) ? data.vodSeries.slice(0, 50) : []);
                  setVodFromM3u(data.vodFromM3u);
                } catch {
                  /* ignore */
                }
              } else {
                const { channels: initialChannels, vodItems: initialVod } = parseM3u(INLINE_SAMPLE_M3U);
                const initialEpg = parseXmltv(SAMPLE_XMLTV);
                setChannels(initialChannels);
                setVodFromM3u(initialVod);
                setEpg(initialEpg);
              }
              catalogHydratedRef.current = true;
            });
          });
        });
        return;
      }
      runAfterPaint(() => {
        if (cancelled) return;
        const data = loadPersistedData();
        const useServer = !!getServerBaseUrl();
        if (!useServer) {
          setChannels(data.channels);
          setEpg(data.epg);
          setVodMovies(data.vodMovies);
          setVodSeries(data.vodSeries);
          setVodFromM3u(data.vodFromM3u);
          if (data.channels.length === 0) {
            const { channels: initialChannels, vodItems: initialVod } = parseM3u(INLINE_SAMPLE_M3U);
            const initialEpg = parseXmltv(SAMPLE_XMLTV);
            setChannels(initialChannels);
            setVodFromM3u(initialVod);
            setEpg(initialEpg);
          }
          catalogHydratedRef.current = true;
        }
        setM3uUrl(data.m3uUrl);
        setEpgUrl(data.epgUrl);
        setXtreamConfigState(data.xtreamConfig);
      });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    saveContinueWatching(continueWatching, userId);
  }, [continueWatching, userId]);

  // Persist loaded data whenever it changes (skip until we've hydrated so we don't overwrite with empty when a new user logs in)
  useEffect(() => {
    if (!catalogHydratedRef.current) return;
    savePersistedData({
      channels,
      epg,
      vodMovies,
      vodSeries,
      vodFromM3u,
      m3uUrl,
      epgUrl,
      xtreamConfig,
    });
  }, [channels, epg, vodMovies, vodSeries, vodFromM3u, m3uUrl, epgUrl, xtreamConfig]);

  const setPlayback = useCallback((state: PlaybackState | null) => {
    setPlaybackState(state);
  }, []);

  const setPreferExternalPlayer = useCallback((value: boolean) => {
    setPreferExternalPlayerState(value);
    try {
      if (value) localStorage.setItem(PREFER_EXTERNAL_PLAYER_KEY, '1');
      else localStorage.removeItem(PREFER_EXTERNAL_PLAYER_KEY);
    } catch {
      /* ignore */
    }
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/preferences').then(({ Preferences }) => {
        Preferences.set({ key: PREFER_EXTERNAL_PLAYER_KEY, value: value ? '1' : '' }).catch(() => {});
      });
    });
  }, []);

  const setExternalPlayerMode = useCallback((value: ExternalPlayerMode) => {
    setExternalPlayerModeState(value);
    try {
      localStorage.setItem(EXTERNAL_PLAYER_MODE_KEY, value);
    } catch {
      /* ignore */
    }
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/preferences').then(({ Preferences }) => {
        Preferences.set({ key: EXTERNAL_PLAYER_MODE_KEY, value }).catch(() => {});
      });
    });
  }, []);

  const playOrOpenExternally = useCallback(
    async (state: PlaybackState) => {
      let url = state?.url != null ? String(state.url).trim() : '';
      if (isServerStreamUrl(url) && serverBaseUrl) {
        try {
          url = await resolveServerStreamUrl(serverBaseUrl, url);
        } catch {
          setPlaybackState(null);
          return;
        }
      }
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        setPlaybackState(null);
        return;
      }
      const safeState = { ...state, url };
      const mode = externalPlayerMode;
      const isAndroid =
        typeof navigator !== 'undefined' &&
        /android/i.test(navigator.userAgent);

      if (!preferExternalPlayer) {
        // On Android use built-in VLC player (codecs/audio); otherwise in-app web player
        if (isAndroid) {
          try {
            const cap = await import('@capacitor/core');
            const { Capacitor, registerPlugin } = cap;
            if (Capacitor.isNativePlatform() && Capacitor.getPlatform?.() === 'android') {
              const OpenWith = registerPlugin<{ playInVlc: (opts: { url: string }) => Promise<void> }>('OpenWith');
              await OpenWith.playInVlc({ url: safeState.url });
              return;
            }
          } catch {
            /* fallback to in-app player */
          }
        }
        setPlaybackState(safeState);
        return;
      }
      try {
        const cap = await import('@capacitor/core');
        const { Capacitor, registerPlugin } = cap;
        const isNative = Capacitor.isNativePlatform();
        const platform = (Capacitor.getPlatform?.() ?? '').toLowerCase();

        if (mode === 'chooser' && isNative && platform === 'android') {
          try {
            const OpenWith = registerPlugin<{ openWith: (opts: { url: string }) => Promise<void> }>('OpenWith');
            await OpenWith.openWith({ url: safeState.url });
            return;
          } catch {
            try {
              const Plugins = (Capacitor as unknown as { Plugins?: { OpenWith?: { openWith: (opts: { url: string }) => Promise<void> } } }).Plugins;
              if (Plugins?.OpenWith?.openWith) {
                await Plugins.OpenWith.openWith({ url: safeState.url });
                return;
              }
            } catch {
              /* ignore */
            }
            setPlaybackState(safeState);
            return;
          }
        }

        if (mode === 'browser' || !isAndroid) {
          if (isNative) {
            const { InAppBrowser } = await import('@capacitor/inappbrowser');
            await InAppBrowser.openInExternalBrowser({ url: safeState.url });
            return;
          }
          try {
            window.open(safeState.url, '_blank', 'noopener,noreferrer');
            return;
          } catch {
            setPlaybackState(safeState);
            return;
          }
        }

        setPlaybackState(safeState);
      } catch {
        setPlaybackState(safeState);
      }
    },
    [preferExternalPlayer, externalPlayerMode, serverBaseUrl]
  );

  const reportPlaybackProgress = useCallback(
    (url: string, progress: number, duration: number, title?: string, poster?: string) => {
      if (duration <= 0 || progress < 0) return;
      const id = url;
      setContinueWatching((prev) => {
        const rest = prev.filter((item) => item.url !== url);
        const item: ContinueWatchingItem = {
          id,
          title: title ?? 'Unknown',
          url,
          progress,
          duration,
          poster,
        };
        return [item, ...rest].slice(0, 20);
      });
    },
    []
  );

  const removeFromContinueWatching = useCallback((id: string) => {
    setContinueWatching((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleFavoriteChannel = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.channelIds.includes(id)
        ? prev.channelIds.filter((x) => x !== id)
        : [...prev.channelIds, id];
      return { ...prev, channelIds: next };
    });
  }, []);

  const toggleFavoriteMovie = useCallback((streamId: number) => {
    const id = Number(streamId);
    if (!Number.isFinite(id)) return;
    setFavorites((prev) => {
      const next = prev.movieIds.includes(id)
        ? prev.movieIds.filter((x) => x !== id)
        : [...prev.movieIds, id];
      return { ...prev, movieIds: next };
    });
  }, []);

  const toggleFavoriteSeries = useCallback((seriesId: number) => {
    const id = Number(seriesId);
    if (!Number.isFinite(id)) return;
    setFavorites((prev) => {
      const next = prev.seriesIds.includes(id)
        ? prev.seriesIds.filter((x) => x !== id)
        : [...prev.seriesIds, id];
      return { ...prev, seriesIds: next };
    });
  }, []);

  const toggleFavoriteM3uVod = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.m3uVodIds.includes(id)
        ? prev.m3uVodIds.filter((x) => x !== id)
        : [...prev.m3uVodIds, id];
      return { ...prev, m3uVodIds: next };
    });
  }, []);

  const isFavoriteChannel = useCallback(
    (id: string) => favorites.channelIds.includes(id),
    [favorites.channelIds]
  );
  const isFavoriteMovie = useCallback(
    (streamId: number) => favorites.movieIds.includes(streamId),
    [favorites.movieIds]
  );
  const isFavoriteSeries = useCallback(
    (seriesId: number) => favorites.seriesIds.includes(seriesId),
    [favorites.seriesIds]
  );
  const isFavoriteM3uVod = useCallback(
    (id: string) => favorites.m3uVodIds.includes(id),
    [favorites.m3uVodIds]
  );

  const loadM3u = useCallback((content: string): LoadResult => {
    try {
      const trimmed = content.trim();
      if (!trimmed) {
        const result = { success: false, message: 'M3U content is empty.' };
        setLastM3uResult(result);
        return result;
      }
      if (trimmed.length > 20 && !trimmed.toUpperCase().startsWith('#EXTM3U')) {
        const result = {
          success: false,
          message: 'Invalid M3U: response does not look like a playlist. Check the URL or try pasting M3U content.',
        };
        setLastM3uResult(result);
        return result;
      }
      const { channels: nextChannels, vodItems: nextVod } = parseM3u(trimmed);
      startTransition(() => {
        setChannels(nextChannels);
        setVodFromM3u(nextVod);
      });
      const parts = [];
      if (nextChannels.length) parts.push(`${nextChannels.length} channel${nextChannels.length !== 1 ? 's' : ''}`);
      if (nextVod.length) parts.push(`${nextVod.length} VOD`);
      const result: LoadResult = {
        success: true,
        message: `Loaded ${parts.join(', ') || '0 items'}.`,
        count: nextChannels.length,
      };
      setLastM3uResult(result);
      catalogHydratedRef.current = true;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse M3U.';
      const result: LoadResult = { success: false, message };
      setLastM3uResult(result);
      return result;
    }
  }, []);

  const loadM3uFromUrl = useCallback(async (url: string): Promise<LoadResult> => {
    const trimmed = url.trim();
    if (!trimmed) {
      const result = { success: false, message: 'URL is empty.' };
      setLastM3uResult(result);
      return result;
    }
    try {
      const text = await fetchTextNativeOrWeb(trimmed, { timeoutMs: M3U_TIMEOUT_MS });
      setM3uUrl(trimmed);
      return loadM3u(text);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Network error. Try again or paste the M3U content instead.';
      const result: LoadResult = { success: false, message };
      setLastM3uResult(result);
      return result;
    }
  }, [loadM3u]);

  const loadEpg = useCallback((xml: string): LoadResult => {
    try {
      const trimmed = xml.trim();
      if (!trimmed) {
        const result = { success: false, message: 'EPG content is empty.' };
        setLastEpgResult(result);
        return result;
      }
      if (trimmed.length > 20 && !trimmed.startsWith('<') && !trimmed.startsWith('<?xml')) {
        const result = {
          success: false,
          message: 'Invalid EPG: response does not look like XMLTV. Check the URL or try pasting EPG XML.',
        };
        setLastEpgResult(result);
        return result;
      }
      const next = parseXmltv(trimmed);
      startTransition(() => {
        setEpg(next);
      });
      const count = next.channels.length;
      const result: LoadResult = {
        success: true,
        message: `Loaded EPG: ${count} channel${count !== 1 ? 's' : ''}.`,
        count,
      };
      setLastEpgResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse XMLTV.';
      const result: LoadResult = { success: false, message };
      setLastEpgResult(result);
      return result;
    }
  }, []);

  const loadEpgFromUrl = useCallback(async (url: string): Promise<LoadResult> => {
    const trimmed = url.trim();
    if (!trimmed) {
      const result = { success: false, message: 'URL is empty.' };
      setLastEpgResult(result);
      return result;
    }
    try {
      const text = await fetchTextNativeOrWeb(trimmed);
      setEpgUrl(trimmed);
      return loadEpg(text);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Network error. Try again or paste the EPG XML instead.';
      const result: LoadResult = { success: false, message };
      setLastEpgResult(result);
      return result;
    }
  }, [loadEpg]);

  const loadSampleData = useCallback(() => {
    const { channels: sampleChannels, vodItems: sampleVod } = parseM3u(INLINE_SAMPLE_M3U);
    const sampleEpg = parseXmltv(SAMPLE_XMLTV);
    startTransition(() => {
      setChannels(sampleChannels);
      setVodFromM3u(sampleVod);
      setEpg(sampleEpg);
    });
    setM3uUrl('');
    setEpgUrl('');
    setLastM3uResult({
      success: true,
      message: `Loaded sample: ${sampleChannels.length} channels.`,
      count: sampleChannels.length,
    });
    setLastEpgResult({
      success: true,
      message: `Loaded sample EPG: ${sampleEpg.channels.length} channels.`,
      count: sampleEpg.channels.length,
    });
    catalogHydratedRef.current = true;
  }, []);

  const clearLoadResults = useCallback(() => {
    setLastM3uResult(null);
    setLastEpgResult(null);
    setLastXtreamResult(null);
    setLastVodResult(null);
  }, []);

  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(PERSISTED_DATA_KEY);
    } catch {
      /* ignore */
    }
    const empty = getEmptyPersisted();
    setChannels(empty.channels);
    setEpg(empty.epg);
    setVodMovies(empty.vodMovies);
    setVodSeries(empty.vodSeries);
    setVodFromM3u(empty.vodFromM3u);
    setM3uUrl(empty.m3uUrl);
    setEpgUrl(empty.epgUrl);
    setXtreamConfigState(empty.xtreamConfig);
    catalogHydratedRef.current = true;
  }, []);

  const setXtreamConfig = useCallback((config: XtreamConfig | null) => {
    setXtreamConfigState(config);
  }, []);

  const loadFromXtream = useCallback(
    async (config: XtreamConfig): Promise<LoadResult> => {
      const base = (config.baseUrl || '').trim();
      if (!base || !config.username.trim() || !config.password.trim()) {
        const result: LoadResult = {
          success: false,
          message: 'Enter Xtream base URL, username, and password.',
        };
        setLastXtreamResult(result);
        return result;
      }
      const normalized: XtreamConfig = {
        baseUrl: base.replace(/\/+$/, ''),
        username: config.username.trim(),
        password: config.password.trim(),
      };
      setXtreamConfigState(normalized);
      let channelCount = 0;
      let epgCount = 0;
      const errors: string[] = [];
      const m3uOut = await fetchM3uFromXtream(normalized)
        .then((text) => ({ ok: true as const, text }))
        .catch((e) => ({ ok: false as const, err: e instanceof Error ? e.message : 'Failed' }));
      if (m3uOut.ok) {
        const r = loadM3u(m3uOut.text);
        channelCount = r.count ?? 0;
      } else {
        errors.push('Channels: ' + m3uOut.err);
      }
      const epgOut = await fetchEpgFromXtream(normalized)
        .then((text) => ({ ok: true as const, text }))
        .catch((e) => ({ ok: false as const, err: e instanceof Error ? e.message : 'Failed' }));
      if (epgOut.ok) {
        const r = loadEpg(epgOut.text);
        epgCount = r.count ?? 0;
      } else {
        errors.push('EPG: ' + epgOut.err);
      }
      const success = channelCount > 0 || epgCount > 0;
      const parts: string[] = [];
      if (channelCount > 0) parts.push(`${channelCount} channel(s)`);
      if (epgCount > 0) parts.push(`EPG: ${epgCount} channel(s)`);
      const result: LoadResult = {
        success,
        message: success
          ? `Loaded ${parts.join(', ')}.${errors.length ? ' ' + errors.join(' ') : ''}`
          : errors.join(' ') || 'Failed to load channels and EPG.',
        count: channelCount,
      };
      setLastXtreamResult(result);
      if (success) catalogHydratedRef.current = true;
      return result;
    },
    [loadM3u, loadEpg]
  );

  const loadVodFromXtream = useCallback(
    async (config: XtreamConfig): Promise<VodLoadResult> => {
      const base = (config.baseUrl || '').trim();
      if (!base || !config.username.trim() || !config.password.trim()) {
        const result: VodLoadResult = {
          success: false,
          message: 'Enter Xtream base URL, username, and password.',
        };
        setLastVodResult(result);
        return result;
      }
      const normalized: XtreamConfig = {
        baseUrl: base.replace(/\/+$/, ''),
        username: config.username.trim(),
        password: config.password.trim(),
      };
      setXtreamConfigState(normalized);
      try {
        const [movies, series] = await Promise.all([
          fetchVodStreams(normalized),
          fetchSeries(normalized),
        ]);
        const movieList = Array.isArray(movies) ? movies : [];
        const seriesList = Array.isArray(series) ? series : [];
        const isNative = (await import('@capacitor/core').then(({ Capacitor }) => Capacitor.isNativePlatform()).catch(() => false)) as boolean;
        const NATIVE_VOD_CAP_MOVIES = 100;
        const NATIVE_VOD_CAP_SERIES = 50;
        startTransition(() => {
          if (isNative) {
            setVodMovies(movieList.slice(0, NATIVE_VOD_CAP_MOVIES));
            setVodSeries(seriesList.slice(0, NATIVE_VOD_CAP_SERIES));
          } else {
            setVodMovies(movieList);
            setVodSeries(seriesList);
          }
        });
        const result: VodLoadResult = {
          success: true,
          message: isNative
            ? `Loaded ${Math.min(movieList.length, NATIVE_VOD_CAP_MOVIES)} movies, ${Math.min(seriesList.length, NATIVE_VOD_CAP_SERIES)} series (capped for this device). Star items in Library to play from here.`
            : `Loaded ${movieList.length} movies, ${seriesList.length} series.`,
          movieCount: movieList.length,
          seriesCount: seriesList.length,
        };
        setLastVodResult(result);
        catalogHydratedRef.current = true;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load VOD from Xtream.';
        const result: VodLoadResult = { success: false, message };
        setLastVodResult(result);
        return result;
      }
    },
    []
  );

  const value = useMemo<AppContextValue>(
    () => ({
      channels,
      epg,
      playback,
      m3uUrl,
      epgUrl,
      lastM3uResult,
      lastEpgResult,
      xtreamConfig,
      vodMovies,
      vodSeries,
      vodFromM3u,
      lastXtreamResult,
      lastVodResult,
      continueWatching,
      favorites,
      setPlayback,
      reportPlaybackProgress,
      removeFromContinueWatching,
      toggleFavoriteChannel,
      toggleFavoriteMovie,
      toggleFavoriteSeries,
      toggleFavoriteM3uVod,
      isFavoriteChannel,
      isFavoriteMovie,
      isFavoriteSeries,
      isFavoriteM3uVod,
      loadM3u,
      loadM3uFromUrl,
      loadEpg,
      loadEpgFromUrl,
      loadSampleData,
      clearLoadResults,
      clearPersistedData,
      setXtreamConfig,
      loadFromXtream,
      loadVodFromXtream,
      preferExternalPlayer,
      setPreferExternalPlayer,
      externalPlayerMode,
      setExternalPlayerMode,
      playOrOpenExternally,
      serverBaseUrl,
      setServerBaseUrl,
      refreshServerCatalog,
    }),
    [
      channels,
      epg,
      playback,
      m3uUrl,
      epgUrl,
      lastM3uResult,
      lastEpgResult,
      xtreamConfig,
      vodMovies,
      vodSeries,
      vodFromM3u,
      lastXtreamResult,
      lastVodResult,
      continueWatching,
      favorites,
      setPlayback,
      reportPlaybackProgress,
      removeFromContinueWatching,
      toggleFavoriteChannel,
      toggleFavoriteMovie,
      toggleFavoriteSeries,
      toggleFavoriteM3uVod,
      isFavoriteChannel,
      isFavoriteMovie,
      isFavoriteSeries,
      isFavoriteM3uVod,
      loadM3u,
      loadM3uFromUrl,
      loadEpg,
      loadEpgFromUrl,
      loadSampleData,
      clearLoadResults,
      clearPersistedData,
      setXtreamConfig,
      loadFromXtream,
      loadVodFromXtream,
      preferExternalPlayer,
      setPreferExternalPlayer,
      externalPlayerMode,
      setExternalPlayerMode,
      playOrOpenExternally,
      serverBaseUrl,
      setServerBaseUrl,
      refreshServerCatalog,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
