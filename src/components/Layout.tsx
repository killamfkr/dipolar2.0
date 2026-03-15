import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Player } from './Player';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export function Layout() {
  const { playback, playbackError, clearPlaybackError } = useApp();
  const { currentUser, users } = useAuth();
  const firstTimeSetup = !currentUser && users.length === 0;

  return (
    <div className={styles.layout}>
      {firstTimeSetup && (
        <div className={styles.firstTimeBanner}>
          First-time setup: go to <Link to="/settings">Settings</Link> → Admin to set an admin password and create your first user. Then sign in with that username and PIN.
        </div>
      )}
      {playbackError && (
        <div className={styles.playbackErrorBanner}>
          <span>{playbackError}</span>
          <button type="button" onClick={clearPlaybackError} aria-label="Dismiss">×</button>
        </div>
      )}
      <div className={styles.layoutRow}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      {playback && (
        <div className={styles.playerWrap}>
          <Player />
        </div>
      )}
    </div>
  );
}
