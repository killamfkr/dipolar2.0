# Streamio IPTV

A Stremio-style media center built in React with **IPTV** and a **full EPG (Electronic Program Guide)**.

## Features

- **Discover** – Stremio-like home with placeholders for movies/series
- **Live TV** – IPTV channel list with full **EPG grid**: scroll by time, see what’s on each channel, click to watch
- **VOD** – Movies and series (Video on Demand). Browse and play from **Xtream Codes** providers.
- **Xtream Codes** – One-login support: enter base URL, username, and password to load Live TV + EPG and/or VOD (movies & series) in Settings.
- **Library** – Placeholder for saved/favorite content
- **Settings** – M3U/EPG URL or paste; **Xtream Codes** section for Live TV + EPG and VOD

## Tech

- **React 19** + **TypeScript** + **Vite**
- **HLS.js** for HLS/m3u8 playback; native `<video>` for direct URLs
- **M3U parser** – parses `#EXTINF` and `tvg-id` / `tvg-logo` / `group-title`
- **XMLTV parser** – parses channels and programmes for the EPG grid

## Run

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Use **Live TV** for the EPG; add your M3U/EPG in **Settings** or use “Load sample M3U & EPG” for demo data (sample streams are example URLs and won’t actually play).

## Adding your IPTV

### M3U + EPG (manual)

1. Go to **Settings**.
2. **M3U**: Enter your playlist URL or paste M3U content. Use `tvg-id` in EXTINF to match EPG channels (e.g. `tvg-id="bbc-one"`).
3. **EPG**: Enter your XMLTV URL or paste XML. Channel `id` in XMLTV should match `tvg-id` in the M3U.

### Xtream Codes (Live TV + EPG + VOD)

1. Go to **Settings** → **Xtream Codes**.
2. Enter your provider’s **base URL** (e.g. `http://example.com:8080`), **username**, and **password**.
3. Click **Load Live TV + EPG** to fetch channels and program guide, and/or **Load VOD (Movies & Series)** to fetch movies and series.
4. Use **Live TV** for the EPG and **VOD** in the sidebar to browse and play movies and series.

### Dipolar Server (Emby-style: one server, many clients)

Use one machine as a **Dipolar Server** so phones, tablets, and the web app all connect to the same catalog and streams without seeing raw M3U/Xtream links.

1. **Run the server** (on a PC, NAS, or cloud):

   **Option A – Docker (recommended for a private server):**
   ```bash
   docker compose up -d
   ```
   Builds and runs the server on port **3333**. Use `http://YOUR_HOST_IP:3333` in the app (e.g. `http://192.168.1.5:3333`).

   **Option B – Node directly:**
   ```bash
   cd server && npm install && npm start
   ```
   Or from the project root: `npm run server` (after `cd server && npm install` once). The server listens on **port 3333** (or `PORT` env).

2. **Load catalog on the server**  
   Use the **admin** API (e.g. from Postman or curl) to load M3U, EPG, Xtream, or VOD:
   - `POST http://YOUR_PC_IP:3333/api/admin/load-m3u` (body: `{ "url": "..." }` or paste M3U)
   - `POST .../api/admin/load-epg` (body: `{ "url": "..." }` or paste XMLTV)
   - `POST .../api/admin/load-xtream` (body: `{ "baseUrl", "username", "password" }`)
   - `POST .../api/admin/load-vod` (same as Xtream; loads movies/series)

3. **Point the app to the server**  
   In the app: **Settings** → **Dipolar Server**. Enter the server URL (e.g. `http://192.168.1.5:3333`) and click **Connect**. Channels and VOD will load from the server; playback uses proxy URLs so users never see stream links.  
   On Android, install the same app, open Settings, and enter the same server URL so all devices use one catalog.

## Build

```bash
npm run build
npm run preview
```

## Private GitHub + Docker

You can keep the repo on a **private GitHub** repository and run only the server in Docker (e.g. on a VPS or NAS):

1. **Create a private repo** on GitHub, then push:
   ```bash
   git remote add origin git@github.com:YOUR_USER/streamio-iptv.git
   git branch -M main
   git push -u origin main
   ```

2. **On the machine that runs the server** (Linux VPS, NAS with Docker, etc.):
   - Clone the repo (use a [Personal Access Token](https://github.com/settings/tokens) or SSH key if the repo is private):
     ```bash
     git clone https://github.com/YOUR_USER/streamio-iptv.git
     cd streamio-iptv
     ```
   - Start the server with Docker:
     ```bash
     docker compose up -d
     ```
   - Open port **3333** in the firewall if clients are on another network.

3. In the **React/Android app**, set **Settings → Dipolar Server** to `http://YOUR_SERVER_IP:3333` so all clients use the same catalog.

The app (web + Android) is built and run separately; only the server needs to run in Docker on the host.

## License

MIT
