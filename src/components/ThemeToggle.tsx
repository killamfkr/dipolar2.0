import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Theme</span>
      <div className={styles.buttons}>
        {(['dark', 'light', 'system'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={theme === t ? styles.btnActive : styles.btn}
            onClick={() => setTheme(t)}
            title={t === 'system' ? 'Follow system' : t}
          >
            {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '💻'}
            <span className={styles.btnText}>{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
