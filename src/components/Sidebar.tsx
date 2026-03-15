import { NavLink } from 'react-router-dom';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/', label: 'Discover', icon: '◉' },
  { to: '/live', label: 'Live TV', icon: '▷' },
  { to: '/vod', label: 'VOD', icon: '🎬' },
  { to: '/library', label: 'Library', icon: '▤' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const { currentUser, logoutUser } = useAuth();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>
          <Logo size={28} />
        </span>
        <span className={styles.logoText}>Dipolar</span>
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')
            }
            end={to === '/'}
          >
            <span className={styles.navIcon}>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.themeWrap}>
        <ThemeToggle />
      </div>
      {currentUser && (
        <div className={styles.userWrap}>
          <span className={styles.userName}>{currentUser.username}</span>
          <button type="button" onClick={logoutUser} className={styles.logoutBtn} title="Sign out">
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
