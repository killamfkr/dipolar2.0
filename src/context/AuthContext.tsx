import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { hashPassword, verifyPassword } from '../utils/authHash';

const ADMIN_HASH_KEY = 'streamio-admin-hash';
const ADMIN_SESSION_KEY = 'streamio-admin-session';
const USERS_KEY = 'streamio-users';
const CURRENT_USER_ID_KEY = 'streamio-current-user-id';

export interface AppUser {
  id: string;
  username: string;
  approved: boolean;
}

interface StoredUser {
  id: string;
  username: string;
  pinHash: string;
  approved?: boolean;
}

interface AuthContextValue {
  // Admin
  hasAdminPassword: boolean;
  isAdminAuthenticated: boolean;
  setAdminPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => void;
  // User
  currentUser: AppUser | null;
  users: AppUser[];
  loginUser: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => void;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (username: string, initialPin: string) => Promise<{ success: boolean; error?: string }>;
  removeUser: (userId: string) => void;
  refreshUsersFromStorage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((u: StoredUser) => ({
      ...u,
      approved: u.approved !== false,
    }));
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]) {
  const json = JSON.stringify(users);
  try {
    localStorage.setItem(USERS_KEY, json);
  } catch {
    /* ignore */
  }
  import('@capacitor/core').then(({ Capacitor }) => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/preferences').then(({ Preferences }) => {
        Preferences.set({ key: USERS_KEY, value: json }).catch(() => {});
      });
    }
  });
}

function getCurrentUserIdSync(): string | null {
  try {
    return localStorage.getItem(CURRENT_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminAuthenticated, setAdminAuthenticated] = useState(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ADMIN_SESSION_KEY) === '1' : false
  );
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(loadStoredUsers);
  const [currentUserId, setCurrentUserId] = useState<string | null>(getCurrentUserIdSync);

  const hasAdminPassword = typeof localStorage !== 'undefined' && !!localStorage.getItem(ADMIN_HASH_KEY);

  const currentUser: AppUser | null =
    currentUserId && storedUsers.length > 0
      ? (() => {
          const u = storedUsers.find((u) => u.id === currentUserId);
          return u ? { id: u.id, username: u.username, approved: u.approved !== false } : null;
        })()
      : null;

  useEffect(() => {
    saveStoredUsers(storedUsers);
  }, [storedUsers]);

  useEffect(() => {
    if (currentUserId) {
      try {
        localStorage.setItem(CURRENT_USER_ID_KEY, currentUserId);
      } catch {
        /* ignore */
      }
      import('@capacitor/core').then(({ Capacitor }) => {
        if (Capacitor.isNativePlatform()) {
          import('@capacitor/preferences').then(({ Preferences }) => {
            Preferences.set({ key: CURRENT_USER_ID_KEY, value: currentUserId }).catch(() => {});
          });
        }
      });
    } else {
      try {
        localStorage.removeItem(CURRENT_USER_ID_KEY);
      } catch {
        /* ignore */
      }
      import('@capacitor/core').then(({ Capacitor }) => {
        if (Capacitor.isNativePlatform()) {
          import('@capacitor/preferences').then(({ Preferences }) => {
            Preferences.remove({ key: CURRENT_USER_ID_KEY }).catch(() => {});
          });
        }
      });
    }
  }, [currentUserId]);

  useEffect(() => {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/preferences').then(({ Preferences }) => {
        const afterPaint = (fn: () => void) => {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => setTimeout(fn, 0));
          } else {
            setTimeout(fn, 0);
          }
        };
        Preferences.get({ key: USERS_KEY }).then(({ value }) => {
          if (value && typeof value === 'string') {
            afterPaint(() => {
              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setStoredUsers(parsed.map((u: StoredUser) => ({ ...u, approved: u.approved !== false })));
                }
              } catch {
                /* ignore */
              }
            });
          }
        });
        Preferences.get({ key: CURRENT_USER_ID_KEY }).then(({ value }) => {
          if (value && typeof value === 'string' && value.trim()) {
            setCurrentUserId(value.trim());
          }
        });
      });
    });
  }, []);

  const setAdminPassword = useCallback(async (password: string) => {
    if (!password.trim()) return { success: false, error: 'Password required' };
    try {
      const hash = await hashPassword(password.trim());
      localStorage.setItem(ADMIN_HASH_KEY, hash);
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      setAdminAuthenticated(true);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to set password' };
    }
  }, []);

  const loginAdmin = useCallback(async (password: string) => {
    const hash = localStorage.getItem(ADMIN_HASH_KEY);
    if (!hash) return { success: false, error: 'No admin password set. Set one first.' };
    try {
      const ok = await verifyPassword(password, hash);
      if (!ok) return { success: false, error: 'Wrong password' };
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      setAdminAuthenticated(true);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Login failed' };
    }
  }, []);

  const logoutAdmin = useCallback(() => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminAuthenticated(false);
  }, []);

  const createUser = useCallback(async (username: string, initialPin: string) => {
    const un = username.trim().toLowerCase();
    const p = initialPin.trim();
    if (!un || !p) return { success: false, error: 'Username and initial PIN required' };
    if (p.length < 4) return { success: false, error: 'PIN must be at least 4 characters' };
    const existing = storedUsers.find((u) => u.username.toLowerCase() === un);
    if (existing) return { success: false, error: 'Username already exists' };
    try {
      const pinHash = await hashPassword(p);
      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newUser: StoredUser = { id, username: un, pinHash, approved: true };
      setStoredUsers((prev) => [...prev, newUser]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to create user' };
    }
  }, [storedUsers]);

  const loginUser = useCallback(async (username: string, pin: string) => {
    const un = username.trim().toLowerCase();
    const p = pin.trim();
    const user = storedUsers.find((u) => u.username.toLowerCase() === un);
    if (!user) return { success: false, error: 'User not found' };
    if (user.approved === false) return { success: false, error: 'Account not approved' };
    try {
      const ok = await verifyPassword(p, user.pinHash);
      if (!ok) return { success: false, error: 'Wrong PIN' };
      setCurrentUserId(user.id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Login failed' };
    }
  }, [storedUsers]);

  const logoutUser = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const changePin = useCallback(
    async (currentPin: string, newPin: string) => {
      if (!currentUserId) return { success: false, error: 'Not logged in' };
      const user = storedUsers.find((u) => u.id === currentUserId);
      if (!user) return { success: false, error: 'User not found' };
      const cur = currentPin.trim();
      const neu = newPin.trim();
      if (!cur || !neu) return { success: false, error: 'Current and new PIN required' };
      if (neu.length < 4) return { success: false, error: 'New PIN must be at least 4 characters' };
      try {
        const ok = await verifyPassword(cur, user.pinHash);
        if (!ok) return { success: false, error: 'Current PIN is wrong' };
        const pinHash = await hashPassword(neu);
        setStoredUsers((prev) =>
          prev.map((u) => (u.id === currentUserId ? { ...u, pinHash } : u))
        );
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to change PIN' };
      }
    },
    [currentUserId, storedUsers]
  );

  const removeUser = useCallback((userId: string) => {
    setStoredUsers((prev) => prev.filter((u) => u.id !== userId));
    if (currentUserId === userId) setCurrentUserId(null);
  }, [currentUserId]);

  const refreshUsersFromStorage = useCallback(() => {
    setStoredUsers(loadStoredUsers());
  }, []);

  const value: AuthContextValue = {
    hasAdminPassword,
    isAdminAuthenticated: adminAuthenticated,
    setAdminPassword,
    loginAdmin,
    logoutAdmin,
    currentUser,
    users: storedUsers.map((u) => ({ id: u.id, username: u.username, approved: u.approved !== false })),
    loginUser,
    logoutUser,
    changePin,
    createUser,
    removeUser,
    refreshUsersFromStorage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
