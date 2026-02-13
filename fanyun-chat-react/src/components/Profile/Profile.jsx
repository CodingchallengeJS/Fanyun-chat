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

function Profile({ isActive, onClose, user, onUserUpdate, targetUserId, onOpenChat, onOpenProfile }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAddingFriend, setAddingFriend] = useState(false);
  const [isOpeningChat, setOpeningChat] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [isReactingPostId, setReactingPostId] = useState(null);

  const [commentPost, setCommentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setPostingComment] = useState(false);
  const [isCommentInputHighlighted, setCommentInputHighlighted] = useState(false);
  const [nestedProfileTargetUserId, setNestedProfileTargetUserId] = useState(null);
  const commentInputRef = useRef(null);
  const commentInputAreaRef = useRef(null);

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

  useEffect(() => {
    if (!isActive) {
      setCommentPost(null);
      setComments([]);
      setCommentsError('');
      setCommentText('');
      setCommentInputHighlighted(false);
      setNestedProfileTargetUserId(null);
    }
  }, [isActive]);

  useEffect(() => {
    // Reset nested/comment stack when root profile target changes from parent navigation.
    setCommentPost(null);
    setComments([]);
    setCommentsError('');
    setCommentText('');
    setCommentInputHighlighted(false);
    setNestedProfileTargetUserId(null);
  }, [targetUserId]);

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

  const loadComments = async (postId) => {
    if (!postId) return;
    setCommentsLoading(true);
    setCommentsError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load comments.');
      }
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      setComments([]);
      setCommentsError(err.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenComments = async (post) => {
    const profileAuthor = profileData?.user;
    const enriched = {
      ...post,
      author: {
        id: profileAuthor?.id || targetUserId || null,
        username: profileAuthor?.username || 'Unknown',
        avatarUrl: profileAuthor?.avatarUrl || null
      },
      isFriend: profileData?.friendshipStatus === 'friend'
    };
    setCommentPost(enriched);
    setCommentText('');
    await loadComments(post.id);
  };

  const handleCloseComments = () => {
    setCommentPost(null);
    setComments([]);
    setCommentsError('');
    setCommentText('');
    setCommentInputHighlighted(false);
  };

  const openNestedProfile = (nextUserId) => {
    const nextId = Number(nextUserId);
    if (!nextId) return;
    if (Number(profileData?.user?.id) === nextId) return;
    setNestedProfileTargetUserId(nextId);
  };

  const focusCommentComposer = () => {
    commentInputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    commentInputRef.current?.focus();
    setCommentInputHighlighted(true);
    window.setTimeout(() => setCommentInputHighlighted(false), 350);
  };

  const handleToggleReaction = async (post) => {
    if (!user?.id || !post?.id) return;
    setReactingPostId(post.id);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, reactionType: 'like' })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to react to post.');
      }

      setProfileData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  reactionCount: Number(data.reactionCount || 0),
                  viewerReactionType: data.viewerReactionType || null,
                  viewerHasReacted: Boolean(data.viewerHasReacted)
                }
              : item
          )
        };
      });

      setCommentPost((prev) => {
        if (!prev || prev.id !== post.id) return prev;
        return {
          ...prev,
          reactionCount: Number(data.reactionCount || 0),
          viewerReactionType: data.viewerReactionType || null,
          viewerHasReacted: Boolean(data.viewerHasReacted)
        };
      });
    } catch (err) {
      setCommentsError(err.message);
    } finally {
      setReactingPostId(null);
    }
  };

  const handleSubmitComment = async () => {
    const content = commentText.trim();
    if (!commentPost?.id || !user?.id || !content) return;
    setPostingComment(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${commentPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: user.id, content })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create comment.');
      }

      setCommentText('');
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
      }

      setProfileData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((item) =>
            item.id === commentPost.id
              ? { ...item, commentCount: Number(data.commentCount || item.commentCount || 0) }
              : item
          )
        };
      });

      setCommentPost((prev) => {
        if (!prev) return prev;
        return { ...prev, commentCount: Number(data.commentCount || prev.commentCount || 0) };
      });
    } catch (err) {
      setCommentsError(err.message);
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div
      id="profile-popup"
      className={`${isActive ? 'active' : ''} ${commentPost || nestedProfileTargetUserId ? 'nested-modal-open' : ''}`.trim()}
      onClick={onClose}
    >
      <div
        className={`popup-content profile-modal ${commentPost || nestedProfileTargetUserId ? 'hidden-by-child-modal' : ''}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close profile-modal-close" onClick={onClose} aria-label="Back">
          <i className="fas fa-arrow-left" aria-hidden="true"></i>
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
                  <article
                    key={post.id}
                    className="profile-post-item profile-post-item-clickable"
                    onClick={() => handleOpenComments(post)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenComments(post);
                      }
                    }}
                  >
                    <div className="profile-post-date">{formatDateTime(post.createdAt)}</div>
                    <p>{post.content}</p>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}

      </div>

      {commentPost && (
        <div
          className={`comments-modal-overlay ${nestedProfileTargetUserId ? 'hidden-by-child-modal' : ''}`.trim()}
          onClick={handleCloseComments}
        >
          <div
            className={`comments-modal ${nestedProfileTargetUserId ? 'hidden-by-child-modal' : ''}`.trim()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="comments-modal-header">
              <h3>Comments</h3>
              <button
                type="button"
                className="comments-modal-close"
                onClick={handleCloseComments}
                aria-label="Back"
              >
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
              </button>
            </div>

            <article className="feed-post comments-modal-post">
              <header className="feed-post-header">
                <button
                  type="button"
                  className="feed-post-avatar-btn"
                  onClick={() => openNestedProfile(commentPost.author?.id)}
                  disabled={!commentPost.author?.id}
                  aria-label={`Open ${commentPost.author?.username || 'user'} profile`}
                >
                  <img
                    src={commentPost.author?.avatarUrl || defaultAvatar}
                    alt={`${commentPost.author?.username || 'User'} avatar`}
                    className="feed-post-avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = defaultAvatar;
                    }}
                  />
                </button>
                <div className="feed-post-header-text">
                  <div className="feed-post-author">{commentPost.author?.username || 'Unknown'}</div>
                  <div className="feed-post-meta">
                    {commentPost.isFriend ? 'Friend' : 'Suggested'} | {formatDateTime(commentPost.createdAt)}
                  </div>
                </div>
              </header>
              <p className="feed-post-content">{commentPost.content}</p>
              <div className="feed-post-actions">
                <button
                  type="button"
                  className={`feed-post-action-btn ${commentPost.viewerHasReacted ? 'active' : ''}`.trim()}
                  onClick={() => handleToggleReaction(commentPost)}
                  disabled={isReactingPostId === commentPost.id}
                >
                  <i className="fa-regular fa-thumbs-up" aria-hidden="true"></i>
                  <span>React</span>
                  <span className="feed-post-action-count">{commentPost.reactionCount || 0}</span>
                </button>
                <button
                  type="button"
                  className="feed-post-action-btn"
                  onClick={focusCommentComposer}
                >
                  <i className="fa-regular fa-comment" aria-hidden="true"></i>
                  <span>Comment</span>
                  <span className="feed-post-action-count">{commentPost.commentCount || 0}</span>
                </button>
              </div>
            </article>

            <div className="comments-list">
              {commentsLoading && <div className="feed-placeholder">Loading comments...</div>}
              {!commentsLoading && commentsError && <div className="feed-error">{commentsError}</div>}
              {!commentsLoading && !commentsError && comments.length === 0 && (
                <div className="feed-placeholder">No comments yet.</div>
              )}
              {!commentsLoading && !commentsError && comments.map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <button
                    type="button"
                    className="comment-avatar-btn"
                    onClick={() => {
                      if (!comment.author?.id) return;
                      openNestedProfile(comment.author.id);
                    }}
                    aria-label={`Open ${comment.author?.username || 'user'} profile`}
                  >
                    <img
                      src={comment.author?.avatarUrl || defaultAvatar}
                      alt={`${comment.author?.username || 'User'} avatar`}
                      className="comment-avatar"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = defaultAvatar;
                      }}
                    />
                  </button>
                  <div className="comment-body">
                    <div className="comment-header">
                      <span className="comment-author">{comment.author?.username || 'Unknown'}</span>
                      <span className="comment-meta">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="comment-content">{comment.content}</p>
                  </div>
                </article>
              ))}
            </div>

            <div
              ref={commentInputAreaRef}
              className={`chat-input comments-input ${isCommentInputHighlighted ? 'highlight' : ''}`.trim()}
            >
              <input
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitComment();
                }}
                placeholder="Write a comment..."
              />
              <button
                type="button"
                className="chat-send-btn"
                onClick={handleSubmitComment}
                aria-label="Send comment"
                disabled={isPostingComment || !commentText.trim()}
              >
                <i className="fas fa-paper-plane" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {nestedProfileTargetUserId && (
        <Profile
          isActive
          onClose={() => setNestedProfileTargetUserId(null)}
          user={user}
          onUserUpdate={onUserUpdate}
          targetUserId={nestedProfileTargetUserId}
          onOpenChat={onOpenChat}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}

export default Profile;
