import React from 'react';

function Setting({ isActive, onClose, onLogout, themeMode, onThemeChange }) {
  if (!isActive) return null;

  return (
    <div id="profile-popup" className={isActive ? 'active' : ''} onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close settings">x</button>
        <h3>Settings</h3>
        <div className="setting-row">
          <p className="setting-label">Theme</p>
          <div className="theme-options" role="group" aria-label="Theme options">
            <button
              type="button"
              className={themeMode === 'light' ? 'theme-option active' : 'theme-option'}
              onClick={() => onThemeChange('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={themeMode === 'dark' ? 'theme-option active' : 'theme-option'}
              onClick={() => onThemeChange('dark')}
            >
              Dark
            </button>
            <button
              type="button"
              className={themeMode === 'system' ? 'theme-option active' : 'theme-option'}
              onClick={() => onThemeChange('system')}
            >
              System
            </button>
          </div>
        </div>
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
