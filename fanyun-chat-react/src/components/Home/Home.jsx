import React, { useEffect, useMemo, useRef, useState } from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';

const POST_PREVIEW_LENGTH = 220;

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

function Home({ currentUser, onOpenProfile }) {
  const apiBase = import.meta.env.VITE_API_URL;
  const [composerText, setComposerText] = useState('');
  const [isPosting, setPosting] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [hasFriends, setHasFriends] = useState(false);
  const [posts, setPosts] = useState([]);
  const [isReactingPostId, setReactingPostId] = useState(null);
  const [expandedPostIds, setExpandedPostIds] = useState({});

  const [commentPost, setCommentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setPostingComment] = useState(false);
  const [isCommentInputHighlighted, setCommentInputHighlighted] = useState(false);
  const commentInputRef = useRef(null);
  const commentInputAreaRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contacts, setContacts] = useState([]);

  const searchLabel = useMemo(() => {
    if (!searchTerm.trim()) return 'Friends';
    return `Search results: "${searchTerm.trim()}"`;
  }, [searchTerm]);

  const loadFeed = async () => {
    if (!currentUser?.id) return;
    setFeedLoading(true);
    setFeedError('');
    try {
      const response = await fetch(`${apiBase}/api/feed?viewerId=${currentUser.id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load feed.');
      }
      setHasFriends(Boolean(data.hasFriends));
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      setFeedError(err.message);
    } finally {
      setFeedLoading(false);
    }
  };

  const loadContacts = async (query = '') => {
    if (!currentUser?.id) return;
    setContactLoading(true);
    try {
      const params = new URLSearchParams({ viewerId: String(currentUser.id) });
      if (query.trim()) params.set('query', query.trim());
      const response = await fetch(`${apiBase}/api/users/discovery?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load contacts.');
      }
      setContacts(Array.isArray(data.users) ? data.users : []);
    } catch {
      setContacts([]);
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    loadContacts('');
  }, [currentUser?.id]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadContacts(searchTerm);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const handleSubmitPost = async () => {
    const content = composerText.trim();
    if (!content || !currentUser?.id) return;
    setPosting(true);
    try {
      const response = await fetch(`${apiBase}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: currentUser.id, content })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create post.');
      }
      setComposerText('');
      if (data.post) {
        setPosts((prev) => [data.post, ...prev]);
      }
    } catch (err) {
      setFeedError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleToggleReaction = async (post) => {
    if (!currentUser?.id || !post?.id) return;
    setReactingPostId(post.id);
    try {
      const response = await fetch(`${apiBase}/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, reactionType: 'like' })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to react to post.');
      }

      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                reactionCount: Number(data.reactionCount || 0),
                viewerReactionType: data.viewerReactionType || null,
                viewerHasReacted: Boolean(data.viewerHasReacted)
              }
            : item
        )
      );
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
      setFeedError(err.message);
    } finally {
      setReactingPostId(null);
    }
  };

  const loadComments = async (postId) => {
    if (!postId) return;
    setCommentsLoading(true);
    setCommentsError('');
    try {
      const response = await fetch(`${apiBase}/api/posts/${postId}/comments`);
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
    setCommentPost(post);
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

  const focusCommentComposer = () => {
    commentInputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    commentInputRef.current?.focus();
    setCommentInputHighlighted(true);
    window.setTimeout(() => setCommentInputHighlighted(false), 350);
  };

  const handleSubmitComment = async () => {
    const content = commentText.trim();
    if (!commentPost?.id || !currentUser?.id || !content) return;
    setPostingComment(true);
    try {
      const response = await fetch(`${apiBase}/api/posts/${commentPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: currentUser.id, content })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create comment.');
      }

      setCommentText('');
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
      }

      setPosts((prev) =>
        prev.map((item) =>
          item.id === commentPost.id
            ? { ...item, commentCount: Number(data.commentCount || item.commentCount || 0) }
            : item
        )
      );
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

  const renderExpandablePostContent = (post, className = 'feed-post-content') => {
    const text = String(post?.content || '');
    const postId = Number(post?.id);
    if (!text) return <p className={className}></p>;

    const isLong = text.length > POST_PREVIEW_LENGTH;
    const isExpanded = Boolean(postId && expandedPostIds[postId]);
    const preview = isLong ? text.slice(0, POST_PREVIEW_LENGTH).trimEnd() : text;

    if (!isLong || isExpanded) {
      return <p className={className}>{text}</p>;
    }

    return (
      <p className={className}>
        {preview}
        {'... '}
        <button
          type="button"
          className="inline-see-more-btn"
          onClick={() =>
            setExpandedPostIds((prev) => ({
              ...prev,
              [postId]: true
            }))
          }
        >
          See more
        </button>
      </p>
    );
  };

  return (
    <section id="home" className="page active">
      <div className="home-layout">
        <div className="home-feed-column">
          <div className="post-composer">
            <h3>What are you thinking?</h3>
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Write something..."
              rows={3}
            />
            <div className="post-composer-actions">
              <button type="button" onClick={handleSubmitPost} disabled={isPosting || !composerText.trim()}>
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>

          {!hasFriends && !feedLoading && (
            <div className="feed-note">
              You do not have friends yet. Your feed currently shows recommended posts from other users.
            </div>
          )}

          {feedError && <div className="feed-error">{feedError}</div>}

          <div className="feed-list">
            {feedLoading && <div className="feed-placeholder">Loading posts...</div>}
            {!feedLoading && posts.length === 0 && (
              <div className="feed-placeholder">No posts yet.</div>
            )}
            {posts.map((post) => (
              <article className="feed-post" key={post.id}>
                <header className="feed-post-header">
                  <button
                    type="button"
                    className="feed-post-avatar-btn"
                    onClick={() => onOpenProfile?.(post.author?.id)}
                    disabled={!post.author?.id}
                    aria-label={`Open ${post.author?.username || 'user'} profile`}
                  >
                    <img
                      src={post.author?.avatarUrl || defaultAvatar}
                      alt={`${post.author?.username || 'User'} avatar`}
                      className="feed-post-avatar"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = defaultAvatar;
                      }}
                    />
                  </button>
                  <div className="feed-post-header-text">
                    <div className="feed-post-author">{post.author?.username || 'Unknown'}</div>
                    <div className="feed-post-meta">
                      {post.isFriend ? 'Friend' : 'Suggested'} | {formatDateTime(post.createdAt)}
                    </div>
                  </div>
                </header>
                {renderExpandablePostContent(post)}
                <div className="feed-post-actions">
                  <button
                    type="button"
                    className={`feed-post-action-btn ${post.viewerHasReacted ? 'active' : ''}`.trim()}
                    onClick={() => handleToggleReaction(post)}
                    disabled={isReactingPostId === post.id}
                  >
                    <i className="fa-regular fa-thumbs-up" aria-hidden="true"></i>
                    <span>React</span>
                    <span className="feed-post-action-count">{post.reactionCount || 0}</span>
                  </button>
                  <button
                    type="button"
                    className="feed-post-action-btn"
                    onClick={() => handleOpenComments(post)}
                  >
                    <i className="fa-regular fa-comment" aria-hidden="true"></i>
                    <span>Comment</span>
                    <span className="feed-post-action-count">{post.commentCount || 0}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="home-contacts-column">
          <h3>Contacts</h3>
          <div className="chat-info-search-bar home-contact-search">
            <i className="fas fa-search" aria-hidden="true"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username or email..."
              aria-label="Search contacts"
            />
          </div>
          <div className="home-contact-caption">{searchLabel}</div>

          <div className="home-contact-list">
            {contactLoading && <div className="home-contact-empty">Searching...</div>}
            {!contactLoading && contacts.length === 0 && (
              <div className="home-contact-empty">No matching users found.</div>
            )}
            {contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className="home-contact-item"
                onClick={() => onOpenProfile?.(contact.id)}
              >
                <img
                  src={contact.avatarUrl || defaultAvatar}
                  alt={`${contact.username} avatar`}
                  className="home-contact-avatar"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = defaultAvatar;
                  }}
                />
                <div className="home-contact-details">
                  <div className="home-contact-main">
                    <span className="home-contact-name">{contact.username}</span>
                    {contact.relation === 'friend' && <span className="home-contact-tag">Friend</span>}
                  </div>
                  <span className="home-contact-email">{contact.email}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="home-contact-self-section">
            <button
              type="button"
              className="home-contact-item home-contact-item-self"
              onClick={() => onOpenProfile?.(currentUser?.id)}
              disabled={!currentUser?.id}
            >
              <img
                src={currentUser?.avatarUrl || defaultAvatar}
                alt={`${currentUser?.username || 'My'} avatar`}
                className="home-contact-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = defaultAvatar;
                }}
              />
              <div className="home-contact-details">
                <div className="home-contact-main">
                  <span className="home-contact-name">{currentUser?.username || 'Me'}</span>
                </div>
                <span className="home-contact-email">{currentUser?.email || ''}</span>
              </div>
            </button>
          </div>
        </aside>
      </div>

      {commentPost && (
        <div className="comments-modal-overlay" onClick={handleCloseComments}>
          <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
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
                  onClick={() => onOpenProfile?.(commentPost.author?.id)}
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
              {renderExpandablePostContent(commentPost)}
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
                      handleCloseComments();
                      onOpenProfile?.(comment.author.id);
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
    </section>
  );
}

export default Home;
