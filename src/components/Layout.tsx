import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Player } from './Player';
import { useApp } from '../context/AppContext';
import styles from './Layout.module.css';

export function Layout() {
  const { playback } = useApp();

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
      {playback && (
        <div className={styles.playerWrap}>
          <Player />
        </div>
      )}
    </div>
  );
}
