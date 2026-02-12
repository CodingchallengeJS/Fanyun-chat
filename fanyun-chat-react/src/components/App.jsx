import React, { useState } from 'react';
import LoginPage from '../pages/LoginPage';
import AppLayout from '../layouts/AppLayout';

function App() {
  const [user, setUser] = useState(null); // null means not logged in

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

  return <AppLayout user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
}

export default App;
