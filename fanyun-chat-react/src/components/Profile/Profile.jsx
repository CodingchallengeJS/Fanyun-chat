// src/components/Profile/Profile.jsx

import React from 'react';

// Accept the 'user' object as a prop
function Profile({ isActive, onClose, user }) {
  if (!isActive) return null;

  // Determine what to display based on the user prop
  const displayName = user && !user.isGuest ? user.username : 'Guest';
  const displayEmail = user && !user.isGuest ? user.email : 'Not logged in';

  return (
    <div id="profile-popup" className={isActive ? 'active' : ''}>
      <div className="popup-content">
        <button className="close" onClick={onClose}>✖</button>
        <h3>My Profile</h3>
        {/* Use the dynamic variables here */}
        <p>Name: {displayName}</p>
        <p>Email: {displayEmail}</p>
      </div>
    </div>
  );
}

export default Profile;