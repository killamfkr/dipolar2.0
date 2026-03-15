import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import styles from './Login.module.css';

export function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result =
      mode === 'login'
        ? await auth.loginUser(username, pin)
        : await auth.registerUser(username, pin);
    setLoading(false);
    if (result.success) {
      setUsername('');
      setPin('');
    } else {
      setError(result.error ?? (mode === 'login' ? 'Login failed' : 'Registration failed'));
    }
  };

  return (
    <div className={styles.page}>
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <ThemeToggle />
      </div>
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <Logo size={40} />
        </div>
        <h1 className={styles.title}>Dipolar</h1>
        <p className={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to continue'
            : 'Create an account to get started'}
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="login-username">
            Username
          </label>
          <input
            id="login-username"
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
            autoComplete="username"
            autoFocus
            disabled={loading}
          />
          <label className={styles.label} htmlFor="login-pin">
            {mode === 'register' ? 'Choose a PIN (min 4 characters)' : 'PIN'}
          </label>
          <input
            id="login-pin"
            type="password"
            inputMode="numeric"
            className={styles.input}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            disabled={loading}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <hr className={styles.divider} />
        <div className={styles.toggleMode}>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login'
              ? 'No account? Register'
              : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
