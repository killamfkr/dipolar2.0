import type { IptvChannel, M3uPlaylist, M3uVodItem } from '../types/iptv';

const VOD_GROUP_PATTERN = /^(movie|movies|vod|series|videos?|film|films)$/i;
const VOD_TVG_TYPE = /^(movie|vod)$/i;

const EXTINF_REG = /#EXTINF:(-?\d+)(?:\s+(.*))?,(.+)/;
const ATTR_REG = /([a-zA-Z-]+)="([^"]*)"/g;

function parseExtinf(line: string): Partial<IptvChannel> & { name: string; tvgType?: string } {
  const m = line.match(EXTINF_REG);
  let name: string;
  let rawAttrs: string | undefined;
  if (m) {
    rawAttrs = m[2];
    name = (m[3] || '').trim();
  } else {
    // Fallback: channel name is everything after the last comma
    const lastComma = line.lastIndexOf(',');
    name = lastComma >= 0 ? line.slice(lastComma + 1).trim() : line.trim();
    if (!name) name = 'Channel';
  }
  const attrs: Record<string, string> = {};
  if (rawAttrs) {
    ATTR_REG.lastIndex = 0; // reset global regex
    let a: RegExpExecArray | null;
    while ((a = ATTR_REG.exec(rawAttrs)) !== null) {
      attrs[a[1]] = a[2];
    }
  }
  const tvgId = attrs['tvg-id'] ?? attrs['tvg_id'];
  const tvgLogo = attrs['tvg-logo'] ?? attrs['tvg_logo'];
  const groupTitle = attrs['group-title'] ?? attrs['group_title'];
  const tvgType = attrs['tvg-type'] ?? attrs['tvg_type'];
  return {
    name: name || 'Channel',
    epgId: tvgId || undefined,
    logo: tvgLogo || undefined,
    group: groupTitle || undefined,
    tvgType: tvgType || undefined,
  };
}

function isVodEntry(info: { group?: string; tvgType?: string }): boolean {
  if (info.tvgType && VOD_TVG_TYPE.test(info.tvgType)) return true;
  const g = (info.group || '').trim();
  if (!g) return false;
  return VOD_GROUP_PATTERN.test(g) || /\b(movie|vod|series)\b/i.test(g);
}

export function parseM3u(content: string): M3uPlaylist {
  const channels: IptvChannel[] = [];
  const vodItems: M3uVodItem[] = [];
  if (!content || typeof content !== 'string') return { channels, vodItems };
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');
  const lines = normalized.split('\n').map((l) => l.trim());
  let i = 0;
  let chIndex = 0;
  let vodIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      const info = parseExtinf(line);
      let j = i + 1;
      while (j < lines.length && !lines[j]) j++;
      const next = lines[j];
      if (next && !next.startsWith('#')) {
        const url = next.trim();
        if (isVodEntry(info)) {
          const id = `m3u-vod-${vodIndex}`;
          vodItems.push({
            id,
            name: info.name,
            url,
            group: info.group,
            logo: info.logo,
          });
          vodIndex++;
        } else {
          const id = (info.epgId || `ch-${chIndex}`).replace(/\s/g, '-');
          channels.push({
            id,
            name: info.name,
            logo: info.logo,
            group: info.group,
            url,
            epgId: info.epgId,
          });
          chIndex++;
        }
        i = j + 1;
        continue;
      }
    }
    i++;
  }

  return { channels, vodItems };
}
