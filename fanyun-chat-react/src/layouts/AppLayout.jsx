import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Home from '../components/Home/Home';
import Messenger from '../components/Messenger/Messenger';
import Contact from '../components/Contact/Contact';
import Profile from '../components/Profile/Profile';
import Setting from '../components/Setting/Setting';

// This component contains the main UI of your application
function AppLayout({ user, onLogout }) {
  const [activePage, setActivePage] = useState('message');
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'contact': return <Contact />;
      case 'home': return <Home />;
      case 'message':
      default:
        return <Messenger currentUser={user} />;
    }
  };

  return (
    <div className="app">
      {/* We can pass onLogout to the sidebar to add a logout button */}
        <Sidebar
            onPageChange={setActivePage}
            onToggleProfile={() => setProfileOpen(!isProfileOpen)}
            onToggleSettings={() => setSettingsOpen(!isSettingsOpen)}
        />

        <main className="content">
            {renderPage()}
        </main>

        <Profile isActive={isProfileOpen} onClose={() => setProfileOpen(false)} user={user} />
        <Setting isActive={isSettingsOpen} onClose={() => setSettingsOpen(false)} />

        <Setting 
            isActive={isSettingsOpen} 
            onClose={() => setSettingsOpen(false)} 
            onLogout={onLogout} 
        />
    </div>
  );
}

export default AppLayout;