import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { buildMovieStreamUrl, resolveXtreamIcon, VOD_POSTER_PLACEHOLDER } from '../utils/xtreamApi';
import { ProxiedPoster } from '../components/ProxiedPoster';
import type { VodMovie } from '../types/xtream';
import styles from '../components/Discover.module.css';

function formatProgress(progress: number, duration: number): string {
  if (duration <= 0 || !Number.isFinite(progress)) return '';
  const pct = Math.min(99, Math.round((progress / duration) * 100));
  return `${pct}%`;
}

export function Discover() {
  const {
    xtreamConfig,
    serverBaseUrl,
    vodMovies,
    vodSeries,
    vodFromM3u,
    continueWatching,
    playOrOpenExternally,
    removeFromContinueWatching,
  } = useApp();

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

  const resumeWatching = useCallback(
    (item: { url: string; title: string; progress: number; duration: number }) => {
      const initialTime = item.duration > 0 ? item.progress : 0;
      playOrOpenExternally({
        url: item.url,
        title: item.title,
        isLive: false,
        initialTime,
      });
    },
    [playOrOpenExternally]
  );

  const DISCOVER_CAP = 36;

  const sortedMovies = useMemo(() => {
    const list = [...vodMovies];
    list.sort((a, b) => {
      const rA = Number(a.rating_5based) || 0;
      const rB = Number(b.rating_5based) || 0;
      if (rB !== rA) return rB - rA;
      const dA = a.added ? new Date(a.added).getTime() : 0;
      const dB = b.added ? new Date(b.added).getTime() : 0;
      return dB - dA;
    });
    return list.slice(0, DISCOVER_CAP);
  }, [vodMovies]);

  const sortedSeries = useMemo(() => {
    const list = [...vodSeries];
    list.sort((a, b) => {
      const rA = Number(a.rating_5based) || 0;
      const rB = Number(b.rating_5based) || 0;
      return rB - rA;
    });
    return list.slice(0, DISCOVER_CAP);
  }, [vodSeries]);

  const cappedM3uVod = useMemo(
    () => vodFromM3u.slice(0, DISCOVER_CAP),
    [vodFromM3u]
  );

  const playM3uVod = useCallback(
    (item: { url: string; name: string }) => {
      playOrOpenExternally({ url: item.url, title: item.name, isLive: false });
    },
    [playOrOpenExternally]
  );

  const hasContent =
    continueWatching.length > 0 ||
    vodMovies.length > 0 ||
    vodSeries.length > 0 ||
    vodFromM3u.length > 0;

  if (!hasContent) {
    return (
      <div className={styles.page}>
        <header className={styles.hero}>
          <h1>Discover</h1>
          <p>Browse movies and series from your IPTV provider.</p>
        </header>
        <div className={styles.emptyState}>
          <p>No content loaded yet.</p>
          <p className={styles.emptyHint}>
            Add <strong>Xtream Codes</strong> in Settings and load VOD to see movies and series here.
            Load an <strong>M3U</strong> with VOD (group-title like Movies/VOD) or <strong>Xtream Codes</strong> to see content here. Or go to <Link to="/live">Live TV</Link> for the EPG.
          </p>
          <Link to="/settings" className={styles.ctaButton}>
            Open Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1>Discover</h1>
        <p>Movies, series, and continue watching from your library.</p>
      </header>

      <section className={styles.sections}>
        {continueWatching.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Continue Watching</h2>
            <div className={styles.cardStrip}>
              {continueWatching.map((item) => (
                <div key={item.id} className={styles.posterCard}>
                  <button
                    type="button"
                    className={styles.posterButton}
                    onClick={() => resumeWatching(item)}
                  >
                    <div className={styles.posterWrap}>
                      {item.poster ? (
                        <img src={item.poster} alt="" className={styles.posterImg} />
                      ) : (
                        <span className={styles.posterPlaceholder}>▶</span>
                      )}
                      {item.duration > 0 && (
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${Math.min(100, (item.progress / item.duration) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <span className={styles.posterTitle}>{item.title}</span>
                    {item.duration > 0 && (
                      <span className={styles.progressLabel}>
                        {formatProgress(item.progress, item.duration)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.removeCard}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromContinueWatching(item.id);
                    }}
                    aria-label="Remove from list"
                    title="Remove from list"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedMovies.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Movies</h2>
            {vodMovies.length > DISCOVER_CAP && (
              <p className={styles.sectionHint}>
                Showing {DISCOVER_CAP} of {vodMovies.length}. <Link to="/vod">See all in VOD</Link>.
              </p>
            )}
            <div className={styles.cardStrip}>
              {sortedMovies.map((movie) => (
                <button
                  key={movie.stream_id}
                  type="button"
                  className={styles.posterCard}
                  onClick={() => playMovie(movie)}
                >
                  <div className={styles.posterWrap}>
                    {(resolveXtreamIcon(xtreamConfig?.baseUrl, movie.stream_icon) || movie.stream_icon) ? (
                      <ProxiedPoster
                        src={resolveXtreamIcon(xtreamConfig?.baseUrl, movie.stream_icon) || movie.stream_icon}
                        fallback={VOD_POSTER_PLACEHOLDER}
                        alt=""
                        className={styles.posterImg}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.posterPlaceholder}>🎬</span>
                    )}
                  </div>
                  <span className={styles.posterTitle}>{movie.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {vodFromM3u.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>VOD from M3U</h2>
            {vodFromM3u.length > DISCOVER_CAP && (
              <p className={styles.sectionHint}>
                Showing {DISCOVER_CAP} of {vodFromM3u.length}. <Link to="/vod">See all in VOD</Link>.
              </p>
            )}
            <div className={styles.cardStrip}>
              {cappedM3uVod.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.posterCard}
                  onClick={() => playM3uVod(item)}
                >
                  <div className={styles.posterWrap}>
                    {item.logo ? (
                      <ProxiedPoster
                        src={item.logo}
                        fallback={VOD_POSTER_PLACEHOLDER}
                        alt=""
                        className={styles.posterImg}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.posterPlaceholder}>🎬</span>
                    )}
                  </div>
                  <span className={styles.posterTitle}>{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {sortedSeries.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Series</h2>
            <p className={styles.sectionHint}>
              {vodSeries.length > DISCOVER_CAP
                ? `Showing ${DISCOVER_CAP} of ${vodSeries.length}. `
                : ''}
              Open a series in <Link to="/vod">VOD</Link> to pick an episode.
            </p>
            <div className={styles.cardStrip}>
              {sortedSeries.map((series) => (
                <Link
                  key={series.series_id}
                  to="/vod"
                  className={styles.posterCard}
                  state={{ openSeries: series.series_id }}
                >
                  <div className={styles.posterWrap}>
                    {(resolveXtreamIcon(xtreamConfig?.baseUrl, series.stream_icon || series.cover) || series.stream_icon || series.cover) ? (
                      <ProxiedPoster
                        src={resolveXtreamIcon(xtreamConfig?.baseUrl, series.stream_icon || series.cover) || series.stream_icon || series.cover}
                        fallback={VOD_POSTER_PLACEHOLDER}
                        alt=""
                        className={styles.posterImg}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.posterPlaceholder}>📺</span>
                    )}
                  </div>
                  <span className={styles.posterTitle}>{series.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
