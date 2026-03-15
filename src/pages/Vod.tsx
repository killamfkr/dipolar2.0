import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  buildMovieStreamUrl,
  buildEpisodeStreamUrl,
  fetchSeriesInfo,
  flattenSeriesEpisodes,
  resolveXtreamIcon,
} from '../utils/xtreamApi';
import type { VodEpisode, VodMovie, VodSeries } from '../types/xtream';
import styles from './Vod.module.css';

/** Poster: on native skip images to avoid WebView crash; on web show img with fallback. */
function VodPoster({ src, alt = '', skipImage = false }: { src: string; alt?: string; skipImage?: boolean }) {
  const [showFallback, setShowFallback] = useState(false);
  const url = (src ?? '').trim();
  if (skipImage || !url || showFallback) {
    return <span className={styles.posterPlaceholder} aria-hidden>🎬</span>;
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setShowFallback(true)}
    />
  );
}

type Tab = 'movies' | 'series' | 'm3u';

const INITIAL_VOD_DISPLAY = 12;
const SHOW_MORE_STEP = 24;

function filterByQuery<T extends { name?: string | null }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => (item.name ?? '').toLowerCase().includes(q));
}

/** Minimal native-only view: no context, no grid, avoids crash when full VOD page loads. */
function VodMinimal() {
  return (
    <div className={styles.page}>
      <h1>VOD</h1>
      <p className={styles.empty}>
        Use &quot;Share stream&quot; from Live TV or Library to open streams in VLC. Full VOD grid is disabled on this device for stability.
      </p>
    </div>
  );
}

export function Vod() {
  const [useNativeMinimal, setUseNativeMinimal] = useState(true);
  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) setUseNativeMinimal(false);
    });
  }, []);
  if (useNativeMinimal) return <VodMinimal />;
  return <VodContent />;
}

function VodContent() {
  const {
    xtreamConfig,
    serverBaseUrl,
    vodMovies,
    vodSeries,
    vodFromM3u,
    playOrOpenExternally,
    toggleFavoriteMovie,
    toggleFavoriteSeries,
    toggleFavoriteM3uVod,
    isFavoriteMovie,
    isFavoriteSeries,
    isFavoriteM3uVod,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('movies');
  const [vodSearchQuery, setVodSearchQuery] = useState('');
  const [seriesDetail, setSeriesDetail] = useState<{
    series: VodSeries;
    episodes: VodEpisode[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_VOD_DISPLAY);

  const openSeriesById = useCallback(
    async (seriesId: number) => {
      if (!Number.isFinite(Number(seriesId)) || !xtreamConfig) return;
      const series = (Array.isArray(vodSeries) ? vodSeries : []).find(
        (s) => s?.series_id != null && Number(s.series_id) === Number(seriesId)
      );
      if (!series) return;
      setTab('series');
      setLoadingDetail(true);
      try {
        const info = await fetchSeriesInfo(xtreamConfig, seriesId);
        const episodes = flattenSeriesEpisodes(info);
        setSeriesDetail({ series, episodes });
      } catch {
        setSeriesDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [vodSeries, xtreamConfig]
  );

  useEffect(() => {
    const state = location.state as { openSeries?: number } | null;
    if (state?.openSeries != null) {
      openSeriesById(state.openSeries);
      navigate('/vod', { replace: true, state: {} });
    }
  }, [location.state, openSeriesById, navigate]);

  const playMovie = useCallback(
    (movie: VodMovie) => {
      const streamId = movie?.stream_id;
      if (streamId == null || (typeof streamId !== 'number' && typeof streamId !== 'string')) return;
      if (serverBaseUrl) {
        playOrOpenExternally({
          url: `server://vod/movie/${streamId}`,
          title: movie.name ?? 'Movie',
          isLive: false,
        });
        return;
      }
      if (!xtreamConfig) return;
      const ext = movie.container_extension || 'mp4';
      const url = buildMovieStreamUrl(xtreamConfig, Number(streamId), ext);
      if (!url) return;
      playOrOpenExternally({ url, title: movie.name ?? 'Movie', isLive: false });
    },
    [xtreamConfig, serverBaseUrl, playOrOpenExternally]
  );

  const openSeries = useCallback(
    async (series: VodSeries) => {
      if (!xtreamConfig || series?.series_id == null) return;
      const sid = Number(series.series_id);
      if (!Number.isFinite(sid)) return;
      setLoadingDetail(true);
      try {
        const info = await fetchSeriesInfo(xtreamConfig, sid);
        const episodes = flattenSeriesEpisodes(info);
        setSeriesDetail({ series, episodes });
      } catch {
        setSeriesDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [xtreamConfig]
  );

  const playEpisode = useCallback(
    (episode: VodEpisode) => {
      if (!seriesDetail) return;
      const id = episode?.id ?? episode?.custom_sid ?? episode?.episode_num;
      if (id == null) return;
      const title = `${seriesDetail.series.name} - S?E${episode.episode_num} ${episode.title || ''}`.trim();
      if (serverBaseUrl) {
        playOrOpenExternally({ url: `server://vod/episode/${id}`, title, isLive: false });
      } else if (xtreamConfig) {
        const ext = episode.container_extension || 'mp4';
        const url = buildEpisodeStreamUrl(xtreamConfig, String(id), ext);
        if (!url) return;
        playOrOpenExternally({ url, title, isLive: false });
      } else return;
      setSeriesDetail(null);
    },
    [xtreamConfig, serverBaseUrl, seriesDetail, playOrOpenExternally]
  );

  const playM3uVod = useCallback(
    (item: { url: string; name: string }) => {
      playOrOpenExternally({ url: item.url, title: item.name, isLive: false });
    },
    [playOrOpenExternally]
  );

  const filteredMovies = useMemo(
    () => filterByQuery(Array.isArray(vodMovies) ? vodMovies : [], vodSearchQuery),
    [vodMovies, vodSearchQuery]
  );
  const filteredSeries = useMemo(
    () => filterByQuery(Array.isArray(vodSeries) ? vodSeries : [], vodSearchQuery),
    [vodSeries, vodSearchQuery]
  );
  const filteredM3uVod = useMemo(
    () => filterByQuery(Array.isArray(vodFromM3u) ? vodFromM3u : [], vodSearchQuery),
    [vodFromM3u, vodSearchQuery]
  );

  const handleShowMore = useCallback(() => {
    setDisplayLimit((prev) => prev + SHOW_MORE_STEP);
  }, []);

  useEffect(() => {
    setDisplayLimit(INITIAL_VOD_DISPLAY);
  }, [tab, vodSearchQuery]);

  const hasVod =
    (Array.isArray(vodMovies) && vodMovies.length > 0) ||
    (Array.isArray(vodSeries) && vodSeries.length > 0) ||
    (Array.isArray(vodFromM3u) && vodFromM3u.length > 0);
  const needsXtream = !xtreamConfig && !hasVod;

  if (needsXtream) {
    return (
      <div className={styles.page}>
        <h1>VOD (Movies & Series)</h1>
        <p className={styles.empty}>
          Add Xtream Codes in Settings and click &quot;Load VOD (Movies & Series)&quot; to browse movies and series here.
        </p>
      </div>
    );
  }

  if (!hasVod) {
    return (
      <div className={styles.page}>
        <h1>VOD (Movies & Series)</h1>
        <p className={styles.empty}>
          No VOD loaded. In Settings, load an M3U with VOD entries (group-title Movies/VOD) or use Xtream Codes and click &quot;Load VOD (Movies & Series)&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>VOD</h1>
        <p>Movies and series from your Xtream provider. Click to play.</p>
        <div className={styles.searchRow}>
          <input
            type="search"
            placeholder="Search movies & series…"
            value={vodSearchQuery}
            onChange={(e) => setVodSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search VOD"
          />
          {vodSearchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setVodSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'movies' ? styles.tabActive : styles.tab}
          onClick={() => setTab('movies')}
        >
          Movies ({filteredMovies.length}{vodSearchQuery ? ` of ${vodMovies.length}` : ''})
        </button>
        <button
          type="button"
          className={tab === 'series' ? styles.tabActive : styles.tab}
          onClick={() => setTab('series')}
        >
          Series ({filteredSeries.length}{vodSearchQuery ? ` of ${vodSeries.length}` : ''})
        </button>
        {vodFromM3u.length > 0 && (
          <button
            type="button"
            className={tab === 'm3u' ? styles.tabActive : styles.tab}
            onClick={() => setTab('m3u')}
          >
            M3U VOD ({filteredM3uVod.length}{vodSearchQuery ? ` of ${vodFromM3u.length}` : ''})
          </button>
        )}
      </div>

      {tab === 'movies' && (
        <>
          <div className={styles.grid}>
            {filteredMovies.slice(0, displayLimit).map((movie, idx) => {
              const streamId = movie?.stream_id != null ? Number(movie.stream_id) : NaN;
              const hasValidId = Number.isFinite(streamId);
              const posterSrc = resolveXtreamIcon(xtreamConfig?.baseUrl, movie?.stream_icon) || movie?.stream_icon;
              return (
                <div key={hasValidId ? `movie-${streamId}` : `movie-fallback-${idx}`} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardButton}
                    onClick={() => playMovie(movie)}
                    disabled={!hasValidId}
                  >
                    <div className={styles.poster}>
                      {posterSrc ? (
                        <VodPoster src={typeof posterSrc === 'string' ? posterSrc : ''} alt="" skipImage={false} />
                      ) : (
                        <span className={styles.posterPlaceholder}>🎬</span>
                      )}
                    </div>
                    <span className={styles.title}>{movie?.name ?? 'Movie'}</span>
                  </button>
                  <button
                    type="button"
                    className={hasValidId && isFavoriteMovie(streamId) ? styles.favBtnActive : styles.favBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (hasValidId) toggleFavoriteMovie(streamId);
                    }}
                    aria-label={hasValidId && isFavoriteMovie(streamId) ? 'Remove from favorites' : 'Add to favorites'}
                    title={hasValidId && isFavoriteMovie(streamId) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {hasValidId && isFavoriteMovie(streamId) ? '★' : '☆'}
                  </button>
                </div>
              );
            })}
          </div>
          {filteredMovies.length > displayLimit && (
            <div className={styles.showMoreWrap}>
              <button type="button" className={styles.showMoreBtn} onClick={handleShowMore}>
                Show more ({filteredMovies.length - displayLimit} more)
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'm3u' && (
        <>
          <div className={styles.grid}>
            {filteredM3uVod.slice(0, displayLimit).map((item, idx) => (
            <div key={item?.id ? String(item.id) : `m3u-vod-${idx}`} className={styles.card}>
              <button
                type="button"
                className={styles.cardButton}
                onClick={() => playM3uVod(item)}
              >
                <div className={styles.poster}>
                  {item.logo ? (
                    <VodPoster src={item.logo} alt="" skipImage={false} />
                  ) : (
                    <span className={styles.posterPlaceholder}>🎬</span>
                  )}
                </div>
                <span className={styles.title}>{item.name}</span>
              </button>
              <button
                type="button"
                className={isFavoriteM3uVod(item.id) ? styles.favBtnActive : styles.favBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavoriteM3uVod(item.id);
                }}
                aria-label={isFavoriteM3uVod(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                title={isFavoriteM3uVod(item.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavoriteM3uVod(item.id) ? '★' : '☆'}
              </button>
            </div>
          ))}
          </div>
          {filteredM3uVod.length > displayLimit && (
            <div className={styles.showMoreWrap}>
              <button type="button" className={styles.showMoreBtn} onClick={handleShowMore}>
                Show more ({filteredM3uVod.length - displayLimit} more)
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'series' && (
        <>
          <div className={styles.grid}>
            {filteredSeries.slice(0, displayLimit).map((series, idx) => {
              const seriesId = series?.series_id != null ? Number(series.series_id) : NaN;
              const hasValidId = Number.isFinite(seriesId);
              const posterSrc = resolveXtreamIcon(xtreamConfig?.baseUrl, series?.stream_icon || series?.cover) || series?.stream_icon || series?.cover;
              return (
                <div key={hasValidId ? `series-${seriesId}` : `series-fallback-${idx}`} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardButton}
                    onClick={() => openSeries(series)}
                    disabled={loadingDetail || !hasValidId}
                  >
                <div className={styles.poster}>
                  {posterSrc ? (
                    <VodPoster src={typeof posterSrc === 'string' ? posterSrc : ''} alt="" skipImage={false} />
                  ) : (
                    <span className={styles.posterPlaceholder}>📺</span>
                  )}
                </div>
                    <span className={styles.title}>{series?.name ?? 'Series'}</span>
                  </button>
                  <button
                    type="button"
                    className={hasValidId && isFavoriteSeries(seriesId) ? styles.favBtnActive : styles.favBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (hasValidId) toggleFavoriteSeries(seriesId);
                    }}
                    aria-label={hasValidId && isFavoriteSeries(seriesId) ? 'Remove from favorites' : 'Add to favorites'}
                    title={hasValidId && isFavoriteSeries(seriesId) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {hasValidId && isFavoriteSeries(seriesId) ? '★' : '☆'}
                  </button>
                </div>
              );
            })}
          </div>
          {filteredSeries.length > displayLimit && (
            <div className={styles.showMoreWrap}>
              <button type="button" className={styles.showMoreBtn} onClick={handleShowMore}>
                Show more ({filteredSeries.length - displayLimit} more)
              </button>
            </div>
          )}
        </>
      )}

      {seriesDetail && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{seriesDetail.series.name}</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSeriesDetail(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.episodeList}>
              {seriesDetail.episodes.map((ep, i) => (
                <button
                  key={ep.id ?? ep.episode_num ?? i}
                  type="button"
                  className={styles.episodeRow}
                  onClick={() => playEpisode(ep)}
                >
                  <span className={styles.epNum}>E{ep.episode_num}</span>
                  <span className={styles.epTitle}>{ep.title || `Episode ${ep.episode_num}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
