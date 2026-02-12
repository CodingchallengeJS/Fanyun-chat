import React from 'react';

function Setting({ isActive, onClose, onLogout }) {
  if (!isActive) return null;

  return (
    <div id="profile-popup" className={isActive ? 'active' : ''} onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close settings">x</button>
        <h3>Settings</h3>
        <p>Theme: Light / Dark</p>
        <p>Notifications: On / Off</p>

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
