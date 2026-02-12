import React, { useEffect, useMemo, useState } from 'react';
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

function Home({ currentUser, onOpenProfile }) {
  const apiBase = import.meta.env.VITE_API_URL;
  const [composerText, setComposerText] = useState('');
  const [isPosting, setPosting] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [hasFriends, setHasFriends] = useState(false);
  const [posts, setPosts] = useState([]);

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
                <p className="feed-post-content">{post.content}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="home-contacts-column">
          <h3>Contacts</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username or email..."
            className="home-contact-search"
          />
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
    </section>
  );
}

export default Home;
