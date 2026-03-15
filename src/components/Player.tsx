import { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import { useApp } from '../context/AppContext';
import styles from './Player.module.css';

export function Player() {
  const { playback, setPlayback, reportPlaybackProgress } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!playback || !videoRef.current) return;
    setLoadError(null);
    const video = videoRef.current;
    const url = playback.url;
    const initialTime = playback.initialTime ?? 0;

    if (url.startsWith('https://example.com') || url.startsWith('http://example.com')) {
      return;
    }

    const onLoadedMetadata = () => {
      if (initialTime > 0 && Number.isFinite(initialTime)) {
        video.currentTime = initialTime;
      }
      video.muted = false;
      video.volume = 1;
      video.play().catch(() => {});
    };
    const onError = () => {
      setLoadError('Playback failed. The link may be broken or the server may not allow in-app playback.');
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    const isHls = /\.m3u8(\?|$)/i.test(url) || url.includes('m3u8');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: playback.isLive,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setLoadError('Stream failed to load. The link may be broken or not allowed.');
          hls.destroy();
          hlsRef.current = null;
        }
      });
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        hls.destroy();
        hlsRef.current = null;
      };
    }
    if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        video.removeAttribute('src');
      };
    }
    video.src = url;
    video.removeAttribute('crossOrigin');
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
    };
  }, [playback?.url, playback?.isLive, playback?.initialTime]);

  const handleClose = () => {
    if (playback && videoRef.current) {
      const { currentTime, duration } = videoRef.current;
      if (duration > 0 && currentTime > 0) {
        reportPlaybackProgress(playback.url, currentTime, duration, playback.title);
      }
    }
    setPlayback(null);
  };

  if (!playback) return null;

  const isPlaceholder = playback.url.startsWith('https://example.com') || playback.url.startsWith('http://example.com');

  return (
    <div className={styles.player}>
      <button
        type="button"
        className={styles.close}
        onClick={handleClose}
        aria-label="Close player"
      >
        ×
      </button>
      <div className={styles.videoWrap}>
        {isPlaceholder ? (
          <div className={styles.placeholder}>
            Sample stream URLs are placeholders and cannot be played. Add a real M3U in Settings.
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className={styles.video}
              controls
              autoPlay
              playsInline
              muted={false}
            />
            {loadError && (
              <div className={styles.errorWrap}>
                <p className={styles.errorText}>{loadError}</p>
                <a
                  href={playback.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openExternal}
                >
                  Open stream in browser
                </a>
              </div>
            )}
          </>
        )}
      </div>
      <div className={styles.title}>{playback.title}</div>
    </div>
  );
}
