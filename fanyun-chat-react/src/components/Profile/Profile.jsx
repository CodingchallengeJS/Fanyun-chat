import React, { useRef, useState } from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function Profile({ isActive, onClose, user, onUserUpdate }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  if (!isActive) return null;

  const displayName = user && !user.isGuest ? user.username : 'Guest';
  const displayEmail = user && !user.isGuest ? user.email : 'Not logged in';
  const avatarSrc = user?.avatarUrl || defaultAvatar;

  const handleAvatarClick = () => {
    if (user?.isGuest || !user?.id || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const imageData = await fileToDataUrl(file);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload avatar.');
      }

      onUserUpdate?.({ avatarUrl: data.avatarUrl });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="profile-popup" className={isActive ? 'active' : ''}>
      <div className="popup-content profile-popup-card">
        <button className="close" onClick={onClose} aria-label="Close profile">
          x
        </button>

        <button
          type="button"
          className="profile-avatar-upload"
          onClick={handleAvatarClick}
          disabled={user?.isGuest || isUploading}
          aria-label={user?.isGuest ? 'Guest account cannot upload avatar' : 'Upload avatar'}
        >
          <img
            src={avatarSrc}
            alt="Your avatar"
            className="profile-avatar-image"
            onError={(evt) => {
              evt.currentTarget.onerror = null;
              evt.currentTarget.src = defaultAvatar;
            }}
          />
          <span className="profile-avatar-overlay">
            <span className="profile-avatar-plus">+</span>
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="profile-avatar-input"
          onChange={handleFileChange}
        />

        <p className="profile-name">{displayName}</p>
        <p className="profile-email">{displayEmail}</p>
        {isUploading && <p className="profile-upload-status">Uploading avatar...</p>}
        {error && <p className="profile-upload-error">{error}</p>}
      </div>
    </div>
  );
}

export default Profile;
