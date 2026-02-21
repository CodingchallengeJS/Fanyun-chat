import React, { useEffect, useState } from 'react';
import LoginPage from '../pages/LoginPage';
import AppLayout from '../layouts/AppLayout';

const THEME_STORAGE_KEY = 'fanyun-theme-mode';

function App() {
  const [user, setUser] = useState(null); // null means not logged in
  const [isAuthChecking, setAuthChecking] = useState(true);
  const [themeMode, setThemeMode] = useState(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState('light');

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (themeMode === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
        return;
      }
      setResolvedTheme(themeMode);
    };

    applyTheme();

    if (themeMode === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }

    return undefined;
  }, [themeMode]);

  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/session`, {
          credentials: 'include'
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!isMounted) return;
        if (data?.user) {
          setUser(data.user);
        }
      } catch {
        // Ignore auth bootstrap errors.
      } finally {
        if (isMounted) {
          setAuthChecking(false);
        }
      }
    };

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || user?.isGuest) return undefined;

    const apiBase = import.meta.env.VITE_API_URL;
    let intervalId = null;

    const sendPresence = async () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        return;
      }

      try {
        const response = await fetch(`${apiBase}/api/users/${user.id}/presence`, {
          method: 'POST',
          credentials: 'include',
          headers: user.token
            ? { Authorization: `Bearer ${user.token}` }
            : undefined
        });
        const data = await response.json();
        if (!response.ok || !data?.lastLogin) return;

        setUser((prev) => {
          if (!prev || prev.id !== user.id) return prev;
          return { ...prev, lastLogin: data.lastLogin };
        });
      } catch {
        // Ignore transient presence-update errors.
      }
    };

    const onFocus = () => {
      sendPresence();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendPresence();
      }
    };

    sendPresence();
    intervalId = window.setInterval(sendPresence, 60 * 1000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id, user?.isGuest, user?.token]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleGuestLogin = () => {
    // Create a temporary guest user object
    const guestUser = {
      username: `Guest-${Math.floor(Math.random() * 1000)}`,
      isGuest: true,
      lastLogin: null
    };
    setUser(guestUser);
  };
  
  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {
      // Ignore logout network errors and still clear local state.
    }
    setUser(null);
  };

  const handleUserUpdate = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  };

  // Conditionally render based on the user state
  if (isAuthChecking) {
    return null;
  }

  if (!user) {
    return <LoginPage 
      onLoginSuccess={handleLoginSuccess} 
      onGuestLogin={handleGuestLogin} 
    />;
  }

  return (
    <AppLayout
      user={user}
      onLogout={handleLogout}
      onUserUpdate={handleUserUpdate}
      themeMode={themeMode}
      resolvedTheme={resolvedTheme}
      onThemeChange={setThemeMode}
    />
  );
}

export default App;
