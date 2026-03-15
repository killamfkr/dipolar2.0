/**
 * Dipolar Server – Emby-style backend for the React/Android app.
 * Run on a PC/NAS: admin loads M3U/Xtream here; Android apps connect and get catalog + stream URLs.
 * No raw M3U/Xtream URLs are sent to clients; they only get channel/vod metadata and a stream URL by id.
 */

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3333;

// In-memory catalog (admin loads M3U/Xtream into this)
let catalog = {
  channels: [],
  epg: { channels: [] },
  vodMovies: [],
  vodSeries: [],
  vodFromM3u: [],
  xtreamConfig: null,
  m3uUrl: '',
  epgUrl: '',
};

// Simple M3U parser (extract #EXTINF lines and next line as URL)
function parseM3u(text) {
  const channels = [];
  const vodItems = [];
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  let chIndex = 0;
  let vodIndex = 0;
  const vodGroups = /^(movie|movies|vod|series|videos?|film|films)$/i;
  const extinf = /#EXTINF:(-?\d+)(?:\s+(.*))?,(.+)/;
  const attr = /([a-zA-Z-]+)="([^"]*)"/g;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      const m = line.match(extinf);
      let name = 'Channel';
      const attrs = {};
      if (m) {
        const raw = m[2] || '';
        let a;
        attr.lastIndex = 0;
        while ((a = attr.exec(raw)) !== null) attrs[a[1]] = a[2];
        name = (m[3] || '').trim() || name;
      }
      const tvgId = attrs['tvg-id'] || attrs['tvg_id'];
      const logo = attrs['tvg-logo'] || attrs['tvg_logo'];
      const group = attrs['group-title'] || attrs['group_title'];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const url = lines[j]?.trim() || '';
      if (url && !url.startsWith('#')) {
        const isVod = vodGroups.test((group || '').trim());
        if (isVod) {
          vodItems.push({
            id: `m3u-vod-${vodIndex}`,
            name,
            url,
            group,
            logo,
          });
          vodIndex++;
        } else {
          channels.push({
            id: (tvgId || `ch-${chIndex}`).replace(/\s/g, '-'),
            name,
            logo,
            group,
            url,
            epgId: tvgId,
          });
          chIndex++;
        }
        i = j;
      }
    }
    i++;
  }
  return { channels, vodItems };
}

// Simple XMLTV parser (channel id and display-name only for EPG)
function parseXmltvSimple(text) {
  const channels = [];
  const channelRe = /<channel\s+id="([^"]*)">[\s\S]*?<display-name[^>]*>([^<]*)<\/display-name>/gi;
  let m;
  while ((m = channelRe.exec(text)) !== null) {
    channels.push({ id: m[1], displayName: m[2].trim() });
  }
  return { channels };
}

// Admin: load M3U from URL
app.post('/api/admin/load-m3u', async (req, res) => {
  try {
    const { m3uUrl, m3uContent } = req.body || {};
    if (m3uContent) {
      const { channels, vodItems } = parseM3u(m3uContent);
      catalog.channels = channels;
      catalog.vodFromM3u = vodItems;
      return res.json({ success: true, channels: channels.length, vod: vodItems.length });
    }
    if (m3uUrl) {
      const r = await fetch(m3uUrl, { signal: AbortSignal.timeout(60000) });
      const text = await r.text();
      const { channels, vodItems } = parseM3u(text);
      catalog.channels = channels;
      catalog.vodFromM3u = vodItems;
      catalog.m3uUrl = m3uUrl;
      return res.json({ success: true, channels: channels.length, vod: vodItems.length });
    }
    return res.status(400).json({ success: false, error: 'm3uUrl or m3uContent required' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: load EPG from URL
app.post('/api/admin/load-epg', async (req, res) => {
  try {
    const { epgUrl } = req.body || {};
    if (!epgUrl) return res.status(400).json({ success: false, error: 'epgUrl required' });
    const r = await fetch(epgUrl, { signal: AbortSignal.timeout(60000) });
    const text = await r.text();
    const { channels } = parseXmltvSimple(text);
    catalog.epg = { channels };
    catalog.epgUrl = epgUrl;
    return res.json({ success: true, channels: channels.length });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: load Xtream (live + EPG)
app.post('/api/admin/load-xtream', async (req, res) => {
  try {
    const { baseUrl, username, password } = req.body || {};
    if (!baseUrl || !username || !password) {
      return res.status(400).json({ success: false, error: 'baseUrl, username, password required' });
    }
    const base = baseUrl.replace(/\/+$/, '');
    catalog.xtreamConfig = { baseUrl: base, username, password };

    const getUrl = `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
    const xmltvUrl = `${base}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const [m3uRes, xmlRes] = await Promise.all([
      fetch(getUrl, { signal: AbortSignal.timeout(90000) }),
      fetch(xmltvUrl, { signal: AbortSignal.timeout(60000) }),
    ]);
    const m3uText = await m3uRes.text();
    const xmlText = await xmlRes.text();

    const { channels } = parseM3u(m3uText);
    const { channels: epgChannels } = parseXmltvSimple(xmlText);
    catalog.channels = channels;
    catalog.epg = { channels: epgChannels };
    return res.json({ success: true, channels: channels.length, epg: epgChannels.length });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: load VOD from Xtream
app.post('/api/admin/load-vod', async (req, res) => {
  try {
    const { baseUrl, username, password } = req.body || {};
    const config = baseUrl && username && password
      ? { baseUrl: baseUrl.replace(/\/+$/, ''), username, password }
      : catalog.xtreamConfig;
    if (!config) return res.status(400).json({ success: false, error: 'Xtream config required' });

    const base = config.baseUrl;
    const moviesUrl = `${base}/player_api.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}&action=get_vod_streams`;
    const seriesUrl = `${base}/player_api.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}&action=get_series`;

    const [moviesRes, seriesRes] = await Promise.all([
      fetch(moviesUrl, { signal: AbortSignal.timeout(60000) }),
      fetch(seriesUrl, { signal: AbortSignal.timeout(60000) }),
    ]);
    const moviesData = await moviesRes.json();
    const seriesData = await seriesRes.json();

    const movies = Array.isArray(moviesData) ? moviesData : (moviesData.movies || []);
    const series = Array.isArray(seriesData) ? seriesData : (seriesData.series || []);
    catalog.vodMovies = movies;
    catalog.vodSeries = series;
    catalog.xtreamConfig = config;
    return res.json({ success: true, movies: movies.length, series: series.length });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ----- Client API (no raw URLs; clients get catalog and request stream by id) -----

app.get('/api/catalog', (req, res) => {
  res.json({
    channels: catalog.channels.map(({ id, name, logo, group, epgId }) => ({ id, name, logo, group, epgId })),
    epg: catalog.epg,
    vodMovies: catalog.vodMovies,
    vodSeries: catalog.vodSeries,
    vodFromM3u: catalog.vodFromM3u,
  });
});

// Resolve stream URL for a channel (by id). Returns { url } so client never sees raw M3U.
app.get('/api/stream/live/:channelId', (req, res) => {
  const ch = catalog.channels.find((c) => c.id === req.params.channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });
  res.json({ url: ch.url, title: ch.name });
});

// Resolve stream URL for VOD movie (Xtream). Client sends movie id or stream_id.
app.get('/api/stream/vod/movie/:id', (req, res) => {
  const id = req.params.id;
  const movie = catalog.vodMovies.find((m) => String(m.stream_id) === id || String(m.num) === id);
  if (!movie || !catalog.xtreamConfig) return res.status(404).json({ error: 'Movie not found' });
  const cfg = catalog.xtreamConfig;
  const base = cfg.baseUrl.endsWith('/') ? cfg.baseUrl : cfg.baseUrl + '/';
  const ext = movie.container_extension || 'mp4';
  const url = `${base}movie/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${movie.stream_id}.${ext.replace(/^\./, '')}`;
  res.json({ url, title: movie.name });
});

// VOD series episode
app.get('/api/stream/vod/episode/:episodeId', (req, res) => {
  if (!catalog.xtreamConfig) return res.status(404).json({ error: 'No Xtream config' });
  const cfg = catalog.xtreamConfig;
  const base = cfg.baseUrl.endsWith('/') ? cfg.baseUrl : cfg.baseUrl + '/';
  const id = req.params.episodeId;
  const url = `${base}series/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${id}.mp4`;
  res.json({ url, title: 'Episode' });
});

// M3U VOD item (by id)
app.get('/api/stream/vod/m3u/:id', (req, res) => {
  const item = catalog.vodFromM3u.find((v) => v.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'VOD item not found' });
  res.json({ url: item.url, title: item.name });
});

// Series episodes (for server-mode clients that don't have xtreamConfig)
function flattenSeriesEpisodes(info) {
  const episodes = info?.episodes;
  if (!episodes) return [];
  if (Array.isArray(episodes)) {
    return [...episodes].sort((a, b) => (a.episode_num || 0) - (b.episode_num || 0));
  }
  const list = [];
  for (const seasonEpisodes of Object.values(episodes)) {
    if (Array.isArray(seasonEpisodes)) list.push(...seasonEpisodes);
  }
  return list.sort((a, b) => (a.episode_num || 0) - (b.episode_num || 0));
}

app.get('/api/series/:seriesId/episodes', async (req, res) => {
  if (!catalog.xtreamConfig) return res.status(404).json({ error: 'No Xtream config' });
  const seriesId = req.params.seriesId;
  const cfg = catalog.xtreamConfig;
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const url = `${base}/player_api.php?username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(r.status).json({ error: 'Series info failed' });
    const data = await r.json();
    const episodes = flattenSeriesEpisodes(data);
    return res.json({ episodes });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load series' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'Dipolar Server' });
});

app.listen(PORT, () => {
  console.log(`Dipolar Server running at http://localhost:${PORT}`);
  console.log('Admin: POST /api/admin/load-m3u, load-epg, load-xtream, load-vod');
  console.log('Clients: GET /api/catalog, /api/stream/live/:id, /api/stream/vod/movie/:id, etc.');
});
