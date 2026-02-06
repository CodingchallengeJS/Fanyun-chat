// src/components/App.jsx

import React, { useState } from 'react';

// --- UPDATE THESE IMPORTS ---
import Sidebar from './Sidebar'; // This path is unchanged
import Home from './Home/Home'; // Updated path
import Messenger from './Messenger/Messenger'; // Updated path
import Contact from './Contact/Contact'; // Updated path
import Profile from './Profile/Profile'; // Updated path
import Setting from './Setting/Setting'; // Updated path
// --- END OF UPDATES ---

function App() {
  const [activePage, setActivePage] = useState('home');
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'message':
        return <Messenger />;
      case 'contact':
        return <Contact />;
      case 'home':
      default:
        return <Home />;
    }
  };

  return (
    <div className="app">
      <Sidebar
        onPageChange={setActivePage}
        onToggleProfile={() => setProfileOpen(!isProfileOpen)}
        onToggleSettings={() => setSettingsOpen(!isSettingsOpen)}
      />

      <main className="content">
        {renderPage()}
      </main>

      <Profile isActive={isProfileOpen} onClose={() => setProfileOpen(false)} />
      <Setting isActive={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;