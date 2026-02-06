import React from 'react';

function Setting({ isActive, onClose }) {
  return (
    // This uses the same CSS as the profile popup for simplicity
    <div id="profile-popup" className={isActive ? 'active' : ''}>
      <div className="popup-content">
        <button className="close" onClick={onClose}>✖</button>
        <h3>Settings</h3>
        <p>Theme: Light / Dark</p>
        <p>Notifications: On / Off</p>
      </div>
    </div>
  );
}

export default Setting;