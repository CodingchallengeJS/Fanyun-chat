import React from 'react';

function Profile({ isActive, onClose }) {
  // Use the `isActive` prop to conditionally apply the 'active' class
  return (
    <div id="profile-popup" className={isActive ? 'active' : ''}>
      <div className="popup-content">
        <button className="close" onClick={onClose}>✖</button>
        <h3>My Profile</h3>
        <p>Name: Your Name</p>
        <p>Email: example@mail.com</p>
      </div>
    </div>
  );
}

export default Profile;