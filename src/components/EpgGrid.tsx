import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EpgChannel, EpgProgram } from '../types/epg';
import type { IptvChannel } from '../types/iptv';
import styles from './EpgGrid.module.css';

const SLOT_MINUTES = 30;
const HOURS_VISIBLE = 6;
const ROW_HEIGHT_PX = 56;
const OVERSCAN = 8;

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface EpgGridProps {
  channels: IptvChannel[];
  epgChannels: EpgChannel[];
  onSelectChannel: (ch: IptvChannel) => void;
  onSelectProgram?: (program: EpgProgram) => void;
  favoriteChannelIds?: string[];
  onToggleFavoriteChannel?: (ch: IptvChannel) => void;
}

function EpgGridInner({
  channels,
  epgChannels,
  onSelectChannel,
  onSelectProgram,
  favoriteChannelIds = [],
  onToggleFavoriteChannel,
}: EpgGridProps) {
  const [scrollTime, setScrollTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeRowRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [timeRowHeight, setTimeRowHeight] = useState(48);

  const { gridStart, gridEnd, timeSlots, epgByChannelId } = useMemo(() => {
    const start = new Date(scrollTime);
    const end = new Date(start);
    end.setHours(end.getHours() + HOURS_VISIBLE);
    const slots: Date[] = [];
    const cur = new Date(start);
    while (cur < end) {
      slots.push(new Date(cur));
      cur.setMinutes(cur.getMinutes() + SLOT_MINUTES);
    }
    const epgByChannelId = new Map<string, EpgChannel>();
    epgChannels.forEach((ec) => epgByChannelId.set(ec.id, ec));
    return {
      gridStart: start,
      gridEnd: end,
      timeSlots: slots,
      epgByChannelId,
    };
  }, [scrollTime, epgChannels]);

  const slotWidth = 80;
  const totalWidth = timeSlots.length * slotWidth;
  const totalHeight = channels.length * ROW_HEIGHT_PX;

  const { visibleStart, visibleEnd } = useMemo(() => {
    if (channels.length === 0) return { visibleStart: 0, visibleEnd: -1 };
    const channelScrollTop = Math.max(0, scrollTop - timeRowHeight);
    const start = Math.max(0, Math.floor(channelScrollTop / ROW_HEIGHT_PX) - OVERSCAN);
    const visibleRows = Math.ceil((containerHeight - timeRowHeight) / ROW_HEIGHT_PX);
    const end = Math.min(
      channels.length - 1,
      Math.floor(channelScrollTop / ROW_HEIGHT_PX) + visibleRows + OVERSCAN
    );
    return { visibleStart: start, visibleEnd: Math.max(start, end) };
  }, [scrollTop, containerHeight, timeRowHeight, channels.length]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const timeRow = timeRowRef.current;
    if (!el) return;
    if (timeRow) setTimeRowHeight(timeRow.offsetHeight);
    setContainerHeight(el.clientHeight);
    setScrollTop(el.scrollTop);
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
      if (timeRowRef.current) setTimeRowHeight(timeRowRef.current.offsetHeight);
    });
    ro.observe(el);
    if (timeRow) ro.observe(timeRow);
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        setScrollTop(el.scrollTop);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  const gridStartTime = gridStart.getTime();
  const gridEndTime = gridEnd.getTime();
  const gridDuration = gridEndTime - gridStartTime;
  const now = Date.now();

  const visibleChannels = useMemo(() => {
    const list: { ch: IptvChannel; index: number }[] = [];
    for (let i = visibleStart; i <= visibleEnd && i < channels.length; i++) {
      list.push({ ch: channels[i], index: i });
    }
    return list;
  }, [channels, visibleStart, visibleEnd]);

  return (
    <div className={styles.epgWrap}>
      <div className={styles.timeNav}>
        <button
          type="button"
          onClick={() => {
            const d = new Date(scrollTime);
            d.setHours(d.getHours() - 2);
            setScrollTime(d);
          }}
        >
          ← Earlier
        </button>
        <span className={styles.timeRange}>
          {formatTime(gridStart)} – {formatTime(gridEnd)}
        </span>
        <button
          type="button"
          onClick={() => {
            const d = new Date(scrollTime);
            d.setHours(d.getHours() + 2);
            setScrollTime(d);
          }}
        >
          Later →
        </button>
      </div>
      <div ref={scrollRef} className={styles.gridScroll}>
        <div className={styles.grid} style={{ width: totalWidth + 200 }}>
          <div ref={timeRowRef} className={styles.timeRow} style={{ width: totalWidth + 200 }}>
            <div className={styles.channelHeaderCell} style={{ width: 200 }} />
            {timeSlots.map((t) => (
              <div
                key={t.getTime()}
                className={styles.timeCell}
                style={{ width: slotWidth }}
              >
                {formatTime(t)}
              </div>
            ))}
          </div>
          <div
            className={styles.virtualContent}
            style={{ height: totalHeight, width: totalWidth + 200 }}
          >
            {visibleChannels.map(({ ch, index }) => {
              const epgChannel = epgByChannelId.get(ch.epgId ?? ch.id);
              const programs = epgChannel?.programs ?? [];
              const channelPrograms = programs.filter(
                (p) => p.end.getTime() > gridStartTime && p.start.getTime() < gridEndTime
              );
              const isFav = favoriteChannelIds.includes(ch.id);

              return (
                <div
                  key={ch.id}
                  className={styles.channelRow}
                  style={{
                    height: ROW_HEIGHT_PX,
                    top: index * ROW_HEIGHT_PX,
                    width: totalWidth + 200,
                  }}
                >
                  <div className={styles.channelCellWrap} style={{ width: 200 }}>
                    <button
                      type="button"
                      className={styles.channelCell}
                      onClick={() => onSelectChannel(ch)}
                    >
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt=""
                          className={styles.channelLogo}
                        />
                      ) : (
                        <span className={styles.channelLogoPlaceholder}>📺</span>
                      )}
                      <span className={styles.channelName}>{ch.name}</span>
                    </button>
                    {onToggleFavoriteChannel && (
                      <button
                        type="button"
                        className={isFav ? styles.favBtnActive : styles.favBtn}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleFavoriteChannel(ch);
                        }}
                        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {isFav ? '★' : '☆'}
                      </button>
                    )}
                  </div>
                  <div
                    className={styles.programsCell}
                    style={{ width: totalWidth }}
                  >
                    {channelPrograms.map((prog) => {
                      const start = prog.start.getTime();
                      const end = prog.end.getTime();
                      const left =
                        ((Math.max(start, gridStartTime) - gridStartTime) / gridDuration) * 100;
                      const width =
                        ((Math.min(end, gridEndTime) - Math.max(start, gridStartTime)) /
                          gridDuration) *
                        100;
                      const isLive = now >= start && now < end;
                      return (
                        <button
                          key={prog.id}
                          type="button"
                          className={`${styles.programBlock} ${isLive ? styles.programLive : ''}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          onClick={() => onSelectProgram?.(prog)}
                          title={`${prog.title} ${formatTime(prog.start)} - ${formatTime(prog.end)}`}
                        >
                          <span className={styles.programTitle}>{prog.title}</span>
                          <span className={styles.programTime}>
                            {formatTime(prog.start)} – {formatTime(prog.end)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const EpgGrid = memo(EpgGridInner);
