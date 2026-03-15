import { useCallback, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { buildMovieStreamUrl, resolveXtreamIcon, VOD_POSTER_PLACEHOLDER } from '../utils/xtreamApi';
import { ProxiedPoster } from '../components/ProxiedPoster';
import type { IptvChannel } from '../types/iptv';
import type { VodMovie, VodSeries } from '../types/xtream';
import styles from '../components/Discover.module.css';
import libStyles from './Library.module.css';

function formatProgress(progress: number, duration: number): string {
  if (duration <= 0 || !Number.isFinite(progress)) return '';
  const pct = Math.min(99, Math.round((progress / duration) * 100));
  return `${pct}%`;
}

export function Library() {
  const {
    channels,
    xtreamConfig,
    serverBaseUrl,
    vodMovies,
    vodSeries,
    vodFromM3u,
    continueWatching,
    favorites,
    playOrOpenExternally,
    removeFromContinueWatching,
    toggleFavoriteChannel,
    toggleFavoriteMovie,
    toggleFavoriteSeries,
    toggleFavoriteM3uVod,
  } = useApp();

  const favoriteChannels = useMemo(
    () => channels.filter((ch) => favorites.channelIds.includes(ch.id)),
    [channels, favorites.channelIds]
  );
  const favoriteMovies = useMemo(
    () => vodMovies.filter((m) => favorites.movieIds.includes(m.stream_id)),
    [vodMovies, favorites.movieIds]
  );
  const favoriteSeries = useMemo(
    () => vodSeries.filter((s) => favorites.seriesIds.includes(s.series_id)),
    [vodSeries, favorites.seriesIds]
  );
  const favoriteM3uVod = useMemo(
    () => vodFromM3u.filter((i) => favorites.m3uVodIds.includes(i.id)),
    [vodFromM3u, favorites.m3uVodIds]
  );

  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => setIsNative(Capacitor.isNativePlatform()));
  }, []);

  const quickPlayMovies = useMemo(
    () => (isNative && Array.isArray(vodMovies) ? vodMovies.slice(0, 20) : []),
    [isNative, vodMovies]
  );
  const quickPlaySeries = useMemo(
    () => (isNative && Array.isArray(vodSeries) ? vodSeries.slice(0, 12) : []),
    [isNative, vodSeries]
  );

  const playChannel = useCallback((ch: IptvChannel) => {
    playOrOpenExternally({ url: ch.url, title: ch.name, isLive: true });
  }, [playOrOpenExternally]);

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
      if (xtreamConfig) {
        const ext = movie.container_extension || 'mp4';
        const url = buildMovieStreamUrl(xtreamConfig, Number(streamId), ext);
        if (url) playOrOpenExternally({ url, title: movie.name ?? 'Movie', isLive: false });
        return;
      }
      playOrOpenExternally({
        url: `server://vod/movie/${streamId}`,
        title: movie.name ?? 'Movie',
        isLive: false,
      });
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

  const playM3uVod = useCallback(
    (item: { url: string; name: string }) => {
      playOrOpenExternally({ url: item.url, title: item.name, isLive: false });
    },
    [playOrOpenExternally]
  );

  const hasAny =
    continueWatching.length > 0 ||
    favoriteChannels.length > 0 ||
    favoriteMovies.length > 0 ||
    favoriteSeries.length > 0 ||
    favoriteM3uVod.length > 0 ||
    quickPlayMovies.length > 0 ||
    quickPlaySeries.length > 0;

  if (!hasAny) {
    return (
      <div className={styles.page}>
        <header className={styles.hero}>
          <h1>Library</h1>
          <p>Your favorites and continue watching.</p>
        </header>
        <div className={styles.emptyState}>
          <p>Nothing in your library yet.</p>
          <p className={styles.emptyHint}>
            Use the <strong>☆</strong> star on <Link to="/live">Live TV</Link> channels and on <Link to="/vod">VOD</Link> movies and series to add them here. Start watching something to see it in Continue Watching.
          </p>
          <Link to="/vod" className={styles.ctaButton}>
            Browse VOD
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1>Library</h1>
        <p>Your favorite channels and VOD, plus continue watching.</p>
      </header>

      <section className={styles.sections}>
        {(quickPlayMovies.length > 0 || quickPlaySeries.length > 0) && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>VOD – tap to play</h2>
            <p className={styles.sectionHint}>
              First movies and series from your provider. Load more in Settings.
            </p>
            {quickPlayMovies.length > 0 && (
              <div className={libStyles.quickList}>
                {quickPlayMovies.map((movie) => (
                  <button
                    key={movie.stream_id}
                    type="button"
                    className={libStyles.quickItem}
                    onClick={() => playMovie(movie)}
                  >
                    <span className={libStyles.quickIcon}>🎬</span>
                    <span className={libStyles.quickTitle}>{movie.name ?? 'Movie'}</span>
                  </button>
                ))}
              </div>
            )}
            {quickPlaySeries.length > 0 && (
              <>
                <h3 className={libStyles.favoritesSubTitle}>Series</h3>
                <p className={styles.sectionHint}>Star series on the web app to play from Favorites here.</p>
                <div className={libStyles.quickList}>
                  {quickPlaySeries.map((series) => (
                    <span key={series.series_id} className={libStyles.quickItem}>
                      <span className={libStyles.quickIcon}>📺</span>
                      <span className={libStyles.quickTitle}>{series.name ?? 'Series'}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

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

        {(favoriteChannels.length > 0 ||
          favoriteMovies.length > 0 ||
          favoriteM3uVod.length > 0 ||
          favoriteSeries.length > 0) && (
          <div className={libStyles.favoritesSection}>
            <h2 className={libStyles.favoritesMainTitle}>Favorites</h2>

            {favoriteChannels.length > 0 && (
              <div className={styles.section}>
                <h3 className={libStyles.favoritesSubTitle}>Channels</h3>
            <div className={styles.cardStrip}>
              {favoriteChannels.map((ch) => (
                <div key={ch.id} className={libStyles.channelCard}>
                  <button
                    type="button"
                    className={libStyles.channelCardButton}
                    onClick={() => playChannel(ch)}
                  >
                    {ch.logo ? (
                      <img src={ch.logo} alt="" className={libStyles.channelLogo} />
                    ) : (
                      <span className={libStyles.channelLogoPlaceholder}>📺</span>
                    )}
                    <span className={libStyles.channelName}>{ch.name}</span>
                  </button>
                  <button
                    type="button"
                    className={libStyles.favBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavoriteChannel(ch.id);
                    }}
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          </div>
            )}

            {favoriteMovies.length > 0 && (
              <div className={styles.section}>
                <h3 className={libStyles.favoritesSubTitle}>Movies</h3>
            <div className={styles.cardStrip}>
              {favoriteMovies.map((movie) => (
                <div key={movie.stream_id} className={styles.posterCard}>
                  <button
                    type="button"
                    className={styles.posterButton}
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
                  <button
                    type="button"
                    className={libStyles.favBtnOverlay}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteMovie(movie.stream_id);
                    }}
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          </div>
            )}

            {favoriteM3uVod.length > 0 && (
              <div className={styles.section}>
                <h3 className={libStyles.favoritesSubTitle}>M3U VOD</h3>
            <div className={styles.cardStrip}>
              {favoriteM3uVod.map((item) => (
                <div key={item.id} className={styles.posterCard}>
                  <button
                    type="button"
                    className={styles.posterButton}
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
                  <button
                    type="button"
                    className={libStyles.favBtnOverlay}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteM3uVod(item.id);
                    }}
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          </div>
            )}

            {favoriteSeries.length > 0 && (
              <div className={styles.section}>
                <h3 className={libStyles.favoritesSubTitle}>Series</h3>
                <p className={styles.sectionHint}>
              Open a series to pick an episode.
            </p>
            <div className={styles.cardStrip}>
              {favoriteSeries.map((series: VodSeries) => (
                <div key={series.series_id} className={styles.posterCard}>
                  <Link
                    to="/vod"
                    className={styles.posterButton}
                    state={{ openSeries: series.series_id }}
                    style={{ textDecoration: 'none', color: 'inherit' }}
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
                  <button
                    type="button"
                    className={libStyles.favBtnOverlay}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavoriteSeries(series.series_id);
                    }}
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
