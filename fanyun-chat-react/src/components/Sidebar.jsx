import React from 'react';

// Accept onLogout from props
function Sidebar({ onPageChange, onToggleProfile, onToggleSettings, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="nav-top">
        <button onClick={() => onPageChange('home')}>🏠</button>
        <button onClick={() => onPageChange('message')}>💬</button>
        <button onClick={() => onPageChange('contact')}>👥</button>
      </div>
      <div className="nav-bottom">
        <button onClick={onToggleProfile}>👤</button>
        <button onClick={onToggleSettings}>⚙️</button>
      </div>
    </aside>
  );
}

export default Sidebar;