import React from 'react';

// 1. Accept onLogout as a prop
function Setting({ isActive, onClose, onLogout }) {
  if (!isActive) return null;

  return (
    <div id="profile-popup" className={isActive ? 'active' : ''}>
      <div className="popup-content">
        <button className="close" onClick={onClose}>✖</button>
        <h3>Settings</h3>
        <p>Theme: Light / Dark</p>
        <p>Notifications: On / Off</p>
        
        {/* 2. Add a container and the logout button */}
        <div className="setting-actions">
          <button className="logout-button" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Setting;