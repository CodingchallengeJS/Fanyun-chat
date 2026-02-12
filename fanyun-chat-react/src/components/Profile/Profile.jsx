import React, { useEffect, useRef, useState } from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';

function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function Profile({ isActive, onClose, user, onUserUpdate, targetUserId, onOpenChat }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAddingFriend, setAddingFriend] = useState(false);
  const [isOpeningChat, setOpeningChat] = useState(false);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (!isActive || !targetUserId || !user?.id) return;
    let isMounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${targetUserId}/profile?viewerId=${user.id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load profile.');
        }
        if (!isMounted) return;
        setProfileData(data);
      } catch (err) {
        if (!isMounted) return;
        setProfileData(null);
        setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [isActive, targetUserId, user?.id]);

  if (!isActive) return null;

  const profileUser = profileData?.user || null;
  const isProfileSelf = profileData?.friendshipStatus === 'self';
  const isFriend = profileData?.friendshipStatus === 'friend';
  const canUploadAvatar = isProfileSelf && !user?.isGuest && !isUploading;

  const handleAvatarClick = () => {
    if (!canUploadAvatar) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !user?.id || !isProfileSelf) return;

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
      setProfileData((prev) => {
        if (!prev) return prev;
        return { ...prev, user: { ...prev.user, avatarUrl: data.avatarUrl } };
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!profileUser?.id || !user?.id) return;
    setAddingFriend(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId: profileUser.id
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add friend.');
      }
      setProfileData((prev) => (prev ? { ...prev, friendshipStatus: 'friend' } : prev));
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingFriend(false);
    }
  };

  const handleOpenChat = async () => {
    if (!profileUser?.id || !user?.id || !onOpenChat) return;
    setOpeningChat(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          targetUserId: profileUser.id
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to open chat.');
      }

      const conversation = data.conversation;
      onOpenChat({
        id: `direct-${conversation.id}`,
        type: 'direct',
        conversationId: conversation.id,
        name: conversation.contact?.name || profileUser.username
      });
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOpeningChat(false);
    }
  };

  return (
    <div id="profile-popup" className={isActive ? 'active' : ''} onClick={onClose}>
      <div className="popup-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close profile-modal-close" onClick={onClose} aria-label="Close profile">
          x
        </button>

        {isLoading && <div className="profile-modal-loading">Loading profile...</div>}
        {error && <div className="profile-modal-error">{error}</div>}

        {!isLoading && profileData && (
          <>
            <div className="profile-modal-top">
              <button
                type="button"
                className="profile-avatar-upload"
                onClick={handleAvatarClick}
                disabled={!canUploadAvatar}
                aria-label={canUploadAvatar ? 'Upload avatar' : 'Profile avatar'}
              >
                <img
                  src={profileUser?.avatarUrl || defaultAvatar}
                  alt={`${profileUser?.username || 'User'} avatar`}
                  className="profile-avatar-image"
                  onError={(evt) => {
                    evt.currentTarget.onerror = null;
                    evt.currentTarget.src = defaultAvatar;
                  }}
                />
                {canUploadAvatar && (
                  <span className="profile-avatar-overlay">
                    <span className="profile-avatar-plus">+</span>
                  </span>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="profile-avatar-input"
                onChange={handleFileChange}
              />

              <h3>{profileUser?.username || 'Unknown'}</h3>
              <p className="profile-modal-email">{profileUser?.email || ''}</p>
              {isUploading && <p className="profile-upload-status">Uploading avatar...</p>}

              <div className="profile-modal-actions">
                {!isProfileSelf && (
                  <button
                    type="button"
                    className="profile-btn primary"
                    onClick={handleAddFriend}
                    disabled={isAddingFriend || isFriend}
                  >
                    {isFriend ? 'Already Friends' : (isAddingFriend ? 'Adding...' : 'Add Friend')}
                  </button>
                )}
                {!isProfileSelf && (
                  <button
                    type="button"
                    className="profile-btn"
                    onClick={handleOpenChat}
                    disabled={isOpeningChat}
                  >
                    {isOpeningChat ? 'Opening...' : 'Message'}
                  </button>
                )}
              </div>
            </div>

            <div className="profile-posts-scroll">
              <div className="profile-posts">
                <h4>Posts</h4>
                {profileData.posts.length === 0 && <p>No posts yet.</p>}
                {profileData.posts.map((post) => (
                  <article key={post.id} className="profile-post-item">
                    <div className="profile-post-date">{formatDateTime(post.createdAt)}</div>
                    <p>{post.content}</p>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;
