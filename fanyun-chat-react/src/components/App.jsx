import React, { useEffect, useState } from 'react';
import LoginPage from '../pages/LoginPage';
import AppLayout from '../layouts/AppLayout';

const THEME_STORAGE_KEY = 'fanyun-theme-mode';

function App() {
  const [user, setUser] = useState(null); // null means not logged in
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

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleGuestLogin = () => {
    // Create a temporary guest user object
    const guestUser = {
      username: `Guest-${Math.floor(Math.random() * 1000)}`,
      isGuest: true
    };
    setUser(guestUser);
  };
  
  const handleLogout = () => {
    setUser(null);
  };

  const handleUserUpdate = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  };

  // Conditionally render based on the user state
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
