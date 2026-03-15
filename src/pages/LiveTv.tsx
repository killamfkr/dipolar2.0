import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { EpgGrid } from '../components/EpgGrid';
import type { IptvChannel } from '../types/iptv';
import styles from './LiveTv.module.css';

const CHANNELS_PER_PAGE = 200;

function filterChannels(channels: IptvChannel[], query: string): IptvChannel[] {
  const q = query.trim().toLowerCase();
  if (!q) return channels;
  return channels.filter(
    (ch) =>
      ch.name.toLowerCase().includes(q) ||
      (ch.epgId && ch.epgId.toLowerCase().includes(q)) ||
      (ch.group && ch.group.toLowerCase().includes(q))
  );
}

export function LiveTv() {
  const {
    channels,
    epg,
    favorites,
    toggleFavoriteChannel,
    playOrOpenExternally,
  } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(CHANNELS_PER_PAGE);

  const filteredChannels = useMemo(
    () => filterChannels(channels, searchQuery),
    [channels, searchQuery]
  );

  const channelsToShow = useMemo(
    () => filteredChannels.slice(0, displayLimit),
    [filteredChannels, displayLimit]
  );

  const hasMore = filteredChannels.length > displayLimit;
  const loadMore = useCallback(() => {
    setDisplayLimit((prev) => prev + CHANNELS_PER_PAGE);
  }, []);

  useEffect(() => {
    setDisplayLimit(CHANNELS_PER_PAGE);
  }, [channels.length]);

  const epgChannels = epg.channels;

  const handleSelectChannel = useCallback((ch: IptvChannel) => {
    playOrOpenExternally({
      url: ch.url,
      title: ch.name,
      isLive: true,
    });
  }, [playOrOpenExternally]);

  if (channels.length === 0) {
    return (
      <div className={styles.page}>
        <h1>Live TV</h1>
        <p className={styles.empty}>
          No channels loaded. Add an M3U playlist in Settings (or use the sample data).
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Live TV & EPG Guide</h1>
        <p>
          Showing {channelsToShow.length} of {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''}. Click a channel to watch, or browse the guide below.
        </p>
        <div className={styles.searchRow}>
          <input
            type="search"
            placeholder="Search channels…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search channels"
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>
      {filteredChannels.length === 0 ? (
        <p className={styles.empty}>
          {searchQuery ? 'No channels match your search. Try a different term or clear the search.' : 'No channels.'}
        </p>
      ) : (
        <>
          <EpgGrid
            channels={channelsToShow}
            epgChannels={epgChannels}
            onSelectChannel={handleSelectChannel}
            favoriteChannelIds={favorites.channelIds}
            onToggleFavoriteChannel={(ch) => toggleFavoriteChannel(ch.id)}
          />
          {hasMore && (
            <div className={styles.loadMoreWrap}>
              <button type="button" className={styles.loadMoreBtn} onClick={loadMore}>
                Show more ({Math.min(CHANNELS_PER_PAGE, filteredChannels.length - displayLimit)} more)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
