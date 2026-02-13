import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Home from '../components/Home/Home';
import Messenger from '../components/Messenger/Messenger';
import Contact from '../components/Contact/Contact';
import Profile from '../components/Profile/Profile';
import Setting from '../components/Setting/Setting';

// This component contains the main UI of your application
function AppLayout({ user, onLogout, onUserUpdate, themeMode, resolvedTheme, onThemeChange }) {
  const [activePage, setActivePage] = useState('home');
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);
  const [profileTargetUserId, setProfileTargetUserId] = useState(user?.id || null);

  const handleOpenChatFromHome = (contact) => {
    setChatTarget(contact);
    setActivePage('message');
  };

  const handleOpenProfile = (targetUserId) => {
    if (!targetUserId) return;
    setProfileTargetUserId(targetUserId);
    setProfileOpen(true);
  };

  const handleToggleProfile = () => {
    setSettingsOpen(false);
    if (isProfileOpen) {
      setProfileOpen(false);
      return;
    }
    handleOpenProfile(user?.id);
  };

  const handleToggleSettings = () => {
    setProfileOpen(false);
    setSettingsOpen((prev) => !prev);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'contact': return <Contact />;
      case 'home': return <Home currentUser={user} onOpenProfile={handleOpenProfile} />;
      case 'message':
      default:
        return <Messenger currentUser={user} preselectedContact={chatTarget} />;
    }
  };

  return (
    <div className={`app theme-${resolvedTheme}`}>
      {/* We can pass onLogout to the sidebar to add a logout button */}
        <Sidebar
            onPageChange={setActivePage}
            onToggleProfile={handleToggleProfile}
            onToggleSettings={handleToggleSettings}
        />

        <main className="content">
            {renderPage()}
        </main>

        <Profile
            isActive={isProfileOpen}
            onClose={() => setProfileOpen(false)}
            user={user}
            onUserUpdate={onUserUpdate}
            targetUserId={profileTargetUserId}
            onOpenChat={handleOpenChatFromHome}
            onOpenProfile={handleOpenProfile}
        />
        <Setting
            isActive={isSettingsOpen}
            onClose={() => setSettingsOpen(false)}
            onLogout={onLogout}
            themeMode={themeMode}
            onThemeChange={onThemeChange}
        />
    </div>
  );
}

export default AppLayout;
