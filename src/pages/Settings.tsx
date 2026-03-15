import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import styles from './Settings.module.css';

export function Settings() {
  const auth = useAuth();
  const {
    m3uUrl,
    epgUrl,
    loadM3uFromUrl,
    loadEpgFromUrl,
    loadM3u,
    loadEpg,
    loadSampleData,
    clearPersistedData,
    channels,
    epg,
    vodFromM3u,
    lastM3uResult,
    lastEpgResult,
    xtreamConfig,
    loadFromXtream,
    loadVodFromXtream,
    lastXtreamResult,
    lastVodResult,
    vodMovies,
    vodSeries,
    preferExternalPlayer,
    setPreferExternalPlayer,
    externalPlayerMode,
    setExternalPlayerMode,
    serverBaseUrl,
    setServerBaseUrl,
    refreshServerCatalog,
  } = useApp();

  const [m3uInput, setM3uInput] = useState(m3uUrl);
  const [epgInput, setEpgInput] = useState(epgUrl);
  const [m3uPaste, setM3uPaste] = useState('');
  const [epgPaste, setEpgPaste] = useState('');
  const [loading, setLoading] = useState<'m3u' | 'epg' | 'xtream' | 'vod' | null>(null);
  const [xtreamBase, setXtreamBase] = useState(xtreamConfig?.baseUrl ?? '');
  const [xtreamUser, setXtreamUser] = useState(xtreamConfig?.username ?? '');
  const [xtreamPass, setXtreamPass] = useState(xtreamConfig?.password ?? '');

  // User login / register
  const [userUsername, setUserUsername] = useState('');
  const [userPin, setUserPin] = useState('');
  const [userError, setUserError] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  // Admin
  const [adminPassword, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');

  useEffect(() => {
    setM3uInput(m3uUrl);
  }, [m3uUrl]);

  useEffect(() => {
    setEpgInput(epgUrl);
  }, [epgUrl]);

  useEffect(() => {
    if (xtreamConfig) {
      setXtreamBase(xtreamConfig.baseUrl);
      setXtreamUser(xtreamConfig.username);
      setXtreamPass(xtreamConfig.password);
    }
  }, [xtreamConfig]);

  useEffect(() => {
    setServerUrlInput(serverBaseUrl);
  }, [serverBaseUrl]);

  const handleUserLogin = async () => {
    setUserError(null);
    setUserLoading(true);
    const result = await auth.loginUser(userUsername, userPin);
    setUserLoading(false);
    if (result.success) {
      setUserUsername('');
      setUserPin('');
    } else {
      setUserError(result.error ?? 'Login failed');
    }
  };

  const handleUserRegister = async () => {
    setUserError(null);
    setUserLoading(true);
    const result = await auth.registerUser(userUsername, userPin);
    setUserLoading(false);
    if (result.success) {
      setUserUsername('');
      setUserPin('');
    } else {
      setUserError(result.error ?? 'Registration failed');
    }
  };

  const handleSetAdminPassword = async () => {
    setAdminError(null);
    setAdminLoading(true);
    const result = await auth.setAdminPassword(adminPassword);
    setAdminLoading(false);
    if (result.success) {
      setAdminPasswordInput('');
    } else {
      setAdminError(result.error ?? 'Failed to set password');
    }
  };

  const handleAdminLogin = async () => {
    setAdminError(null);
    setAdminLoading(true);
    const result = await auth.loginAdmin(adminPassword);
    setAdminLoading(false);
    if (result.success) {
      setAdminPasswordInput('');
    } else {
      setAdminError(result.error ?? 'Login failed');
    }
  };

  const handleLoadXtream = async () => {
    setLoading('xtream');
    try {
      await loadFromXtream({
        baseUrl: xtreamBase.trim(),
        username: xtreamUser.trim(),
        password: xtreamPass.trim(),
      });
    } finally {
      setLoading(null);
    }
  };

  const handleLoadVod = async () => {
    setLoading('vod');
    try {
      await loadVodFromXtream({
        baseUrl: xtreamBase.trim(),
        username: xtreamUser.trim(),
        password: xtreamPass.trim(),
      });
    } finally {
      setLoading(null);
    }
  };

  const handleLoadM3uUrl = async () => {
    if (!m3uInput.trim()) return;
    setLoading('m3u');
    try {
      await loadM3uFromUrl(m3uInput.trim());
    } finally {
      setLoading(null);
    }
  };

  const handleLoadEpgUrl = async () => {
    if (!epgInput.trim()) return;
    setLoading('epg');
    try {
      await loadEpgFromUrl(epgInput.trim());
    } finally {
      setLoading(null);
    }
  };

  const handleLoadM3uPaste = () => {
    if (m3uPaste.trim()) {
      loadM3u(m3uPaste.trim());
      setM3uPaste('');
    }
  };

  const handleLoadEpgPaste = () => {
    if (epgPaste.trim()) {
      loadEpg(epgPaste.trim());
      setEpgPaste('');
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Settings</h1>
        <p>User account, app preferences, and (for admins) IPTV sources.</p>
      </header>

      {/* ——— User & App (always visible) ——— */}
      <section className={styles.section}>
        <h2>User &amp; app</h2>
        {auth.currentUser ? (
          <>
            <p className={styles.desc}>
              Logged in as <strong>{auth.currentUser.username}</strong>. Your theme and continue-watching are saved per profile.
            </p>
            <div className={styles.row}>
              <button type="button" onClick={auth.logoutUser} className={styles.btnSecondary}>
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.desc}>
              Log in or register to keep your theme and continue-watching separate from other users.
            </p>
            <div className={styles.row}>
              <input
                type="text"
                placeholder="Username"
                value={userUsername}
                onChange={(e) => setUserUsername(e.target.value)}
                className={styles.input}
              />
              <input
                type="password"
                placeholder="PIN (min 4 characters)"
                value={userPin}
                onChange={(e) => setUserPin(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.row}>
              <button
                type="button"
                onClick={handleUserLogin}
                disabled={userLoading || !userUsername.trim() || !userPin.trim()}
                className={styles.btn}
              >
                {userLoading ? '…' : 'Login'}
              </button>
              <button
                type="button"
                onClick={handleUserRegister}
                disabled={userLoading || !userUsername.trim() || userPin.length < 4}
                className={styles.btnSecondary}
              >
                Register
              </button>
            </div>
            {userError && <p className={styles.resultError}>{userError}</p>}
          </>
        )}
        <h3 className={styles.subHeading}>Appearance</h3>
        <p className={styles.desc}>
          Choose dark or light theme. System follows your device preference.
        </p>
        <ThemeToggle />

        <h3 className={styles.subHeading}>Dipolar Server (Emby-style)</h3>
        <p className={styles.desc}>
          Point this app to a Dipolar Server on your network. The server holds the channel/VOD catalog; users never see stream links. Run the server on a PC (e.g. <code>cd server &amp;&amp; npm install &amp;&amp; npm start</code>), then enter its URL and connect.
        </p>
        <div className={styles.row}>
          <input
            type="url"
            placeholder="http://192.168.1.5:3333"
            value={serverUrlInput || serverBaseUrl}
            onChange={(e) => setServerUrlInput(e.target.value)}
            className={styles.input}
          />
          <button
            type="button"
            onClick={() => setServerBaseUrl(serverUrlInput.trim())}
            className={styles.btn}
          >
            {serverBaseUrl ? 'Update' : 'Connect'}
          </button>
          <button
            type="button"
            onClick={() => refreshServerCatalog()}
            className={styles.btnSecondary}
            disabled={!serverBaseUrl}
          >
            Refresh catalog
          </button>
        </div>
        {serverBaseUrl ? (
          <p className={styles.resultSuccess}>
            Using server: {serverBaseUrl}. Clear the field and click Update to use local config again.
          </p>
        ) : null}

        <h3 className={styles.subHeading}>Playback</h3>
        <p className={styles.desc}>
          When off, streams play in-app: on Android the built-in VLC player is used (good codecs and audio). When on, streams open externally: share (VLC/MX Player) or system browser.
        </p>
        <div className={styles.row}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={preferExternalPlayer}
              onChange={(e) => setPreferExternalPlayer(e.target.checked)}
            />
            <span>Play in external player</span>
          </label>
        </div>
        {preferExternalPlayer && (
          <div className={styles.externalChoice}>
            <p className={styles.desc}>How to open the stream:</p>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="externalPlayerMode"
                checked={externalPlayerMode === 'chooser'}
                onChange={() => setExternalPlayerMode('chooser')}
              />
              <span>Share stream (pick VLC, MX Player, etc. for correct codecs)</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="externalPlayerMode"
                checked={externalPlayerMode === 'browser'}
                onChange={() => setExternalPlayerMode('browser')}
              />
              <span>Open in system browser</span>
            </label>
          </div>
        )}
      </section>

      {/* ——— Admin (set password / login / IPTV when authenticated) ——— */}
      <section className={styles.section}>
        <h2>Admin</h2>
        {!auth.hasAdminPassword ? (
          <>
            <p className={styles.desc}>
              Set an admin password to unlock IPTV settings (M3U, EPG, Xtream). This is stored locally.
            </p>
            <div className={styles.row}>
              <input
                type="password"
                placeholder="New admin password"
                value={adminPassword}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                onClick={handleSetAdminPassword}
                disabled={adminLoading || !adminPassword.trim()}
                className={styles.btn}
              >
                {adminLoading ? '…' : 'Set admin password'}
              </button>
            </div>
            {adminError && <p className={styles.resultError}>{adminError}</p>}
          </>
        ) : !auth.isAdminAuthenticated ? (
          <>
            <p className={styles.desc}>
              Enter admin password to view and edit IPTV sources.
            </p>
            <div className={styles.row}>
              <input
                type="password"
                placeholder="Admin password"
                value={adminPassword}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                onClick={handleAdminLogin}
                disabled={adminLoading || !adminPassword.trim()}
                className={styles.btn}
              >
                {adminLoading ? '…' : 'Admin login'}
              </button>
            </div>
            {adminError && <p className={styles.resultError}>{adminError}</p>}
          </>
        ) : (
          <>
            <p className={styles.desc}>
              You have access to IPTV settings. Use &quot;Admin logout&quot; when done.
            </p>
            <div className={styles.row}>
              <button type="button" onClick={auth.logoutAdmin} className={styles.btnSecondary}>
                Admin logout
              </button>
            </div>

            {/* IPTV Playlist (M3U) — only when admin authenticated */}
            <h3 className={styles.subHeading}>IPTV Playlist (M3U)</h3>
            <p className={styles.desc}>
              Enter an M3U/M3U8 URL or paste playlist content. Channels will appear in Live TV.
            </p>
            <div className={styles.row}>
              <input
                type="url"
                placeholder="https://example.com/playlist.m3u"
                value={m3uInput}
                onChange={(e) => setM3uInput(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                onClick={handleLoadM3uUrl}
                disabled={loading === 'm3u' || !m3uInput.trim()}
                className={styles.btn}
              >
                {loading === 'm3u' ? 'Loading…' : 'Load URL'}
              </button>
            </div>
            {lastM3uResult && (
              <p className={lastM3uResult.success ? styles.resultSuccess : styles.resultError}>
                {lastM3uResult.message}
              </p>
            )}
            <div className={styles.pasteRow}>
              <textarea
                placeholder="Paste M3U content here…"
                value={m3uPaste}
                onChange={(e) => setM3uPaste(e.target.value)}
                className={styles.textarea}
                rows={4}
              />
              <button
                type="button"
                onClick={handleLoadM3uPaste}
                disabled={!m3uPaste.trim()}
                className={styles.btn}
              >
                Load pasted M3U
              </button>
            </div>

            <h3 className={styles.subHeading}>EPG Guide (XMLTV)</h3>
            <p className={styles.desc}>
              Enter an XMLTV URL or paste XML content. Channel IDs (tvg-id in M3U) will be matched to show program guide.
            </p>
            <div className={styles.row}>
              <input
                type="url"
                placeholder="https://example.com/epg.xml"
                value={epgInput}
                onChange={(e) => setEpgInput(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                onClick={handleLoadEpgUrl}
                disabled={loading === 'epg' || !epgInput.trim()}
                className={styles.btn}
              >
                {loading === 'epg' ? 'Loading…' : 'Load URL'}
              </button>
            </div>
            {lastEpgResult && (
              <p className={lastEpgResult.success ? styles.resultSuccess : styles.resultError}>
                {lastEpgResult.message}
              </p>
            )}
            <div className={styles.pasteRow}>
              <textarea
                placeholder="Paste XMLTV content here…"
                value={epgPaste}
                onChange={(e) => setEpgPaste(e.target.value)}
                className={styles.textarea}
                rows={4}
              />
              <button
                type="button"
                onClick={handleLoadEpgPaste}
                disabled={!epgPaste.trim()}
                className={styles.btn}
              >
                Load pasted EPG
              </button>
            </div>

            <h3 className={styles.subHeading}>Xtream Codes</h3>
            <p className={styles.desc}>
              Use your provider&apos;s Xtream Codes API (base URL, username, password) to load Live TV, EPG, and VOD in one go.
            </p>
            <div className={styles.row}>
              <input
                type="text"
                placeholder="http://example.com:8080"
                value={xtreamBase}
                onChange={(e) => setXtreamBase(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                placeholder="Username"
                value={xtreamUser}
                onChange={(e) => setXtreamUser(e.target.value)}
                className={styles.input}
              />
              <input
                type="password"
                placeholder="Password"
                value={xtreamPass}
                onChange={(e) => setXtreamPass(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.row}>
              <button
                type="button"
                onClick={handleLoadXtream}
                disabled={loading === 'xtream' || !xtreamBase.trim() || !xtreamUser.trim() || !xtreamPass.trim()}
                className={styles.btn}
              >
                {loading === 'xtream' ? 'Loading…' : 'Load Live TV + EPG'}
              </button>
              <button
                type="button"
                onClick={handleLoadVod}
                disabled={loading === 'vod' || !xtreamBase.trim() || !xtreamUser.trim() || !xtreamPass.trim()}
                className={styles.btn}
              >
                {loading === 'vod' ? 'Loading…' : 'Load VOD (Movies & Series)'}
              </button>
            </div>
            {lastXtreamResult && (
              <p className={lastXtreamResult.success ? styles.resultSuccess : styles.resultError}>
                {lastXtreamResult.message}
              </p>
            )}
            {lastVodResult && (
              <p className={lastVodResult.success ? styles.resultSuccess : styles.resultError}>
                {lastVodResult.message}
              </p>
            )}

            <h3 className={styles.subHeading}>Sample data &amp; persistence</h3>
            <p className={styles.desc}>
              Loaded channels, EPG, VOD, and Xtream settings are saved automatically and restored when you return.
            </p>
            <div className={styles.row}>
              <button type="button" onClick={loadSampleData} className={styles.btn}>
                Load sample M3U &amp; EPG
              </button>
              <button
                type="button"
                onClick={clearPersistedData}
                className={styles.btnSecondary}
                title="Clear all saved channels, EPG, VOD, and Xtream config"
              >
                Clear saved data
              </button>
            </div>

            <section className={styles.status}>
              <p>
                <strong>Channels:</strong> {channels.length} | <strong>EPG:</strong> {epg.channels.length} | <strong>M3U VOD:</strong> {vodFromM3u.length} | <strong>Movies:</strong> {vodMovies.length} | <strong>Series:</strong> {vodSeries.length}
              </p>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
