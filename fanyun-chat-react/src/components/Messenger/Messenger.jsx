import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Message from './Message';
import DateDivider from './DateDivider';
import ContactList from './ContactList';
import socket from '../../lib/socket';
import defaultAvatar from '../../assets/default-avatar.svg';
import AvatarWithStatus from '../Common/AvatarWithStatus';

const GROUP_TIME = 2 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 60;
const GLOBAL_CONTACT = { id: 'global-chat-01', name: 'Global Chat', type: 'group' };
const PINNED_STORAGE_KEY = 'messengerPinnedConversationKeys';

const formatRelativeTime = (timestamp) => {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return 'Just now';

  const diffMs = Date.now() - ts;
  if (diffMs <= 0) return 'Just now';

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  if (diffMs >= month) {
    const value = Math.floor(diffMs / month);
    return `${value} month${value === 1 ? '' : 's'} ago`;
  }
  if (diffMs >= day) {
    const value = Math.floor(diffMs / day);
    return `${value} day${value === 1 ? '' : 's'} ago`;
  }
  if (diffMs >= hour) {
    const value = Math.floor(diffMs / hour);
    return `${value} hour${value === 1 ? '' : 's'} ago`;
  }
  if (diffMs >= minute) {
    const value = Math.floor(diffMs / minute);
    return `${value} minute${value === 1 ? '' : 's'} ago`;
  }

  return 'Just now';
};

function Messenger({ currentUser, preselectedContact, onOpenProfile }) {
  const [messages, setMessages] = useState([]);
  const [hasMoreBefore, setHasMoreBefore] = useState(true);
  const [isLoadingOlder, setLoadingOlder] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeContact, setActiveContact] = useState(preselectedContact || GLOBAL_CONTACT);
  const [isChatInfoOpen, setChatInfoOpen] = useState(true);
  const [isSearchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchPanelConversationKey, setSearchPanelConversationKey] = useState(null);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [pinnedConversationKeys, setPinnedConversationKeys] = useState(() => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });
  const chatBodyRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const prependScrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageNodeMapRef = useRef(new Map());
  const clearHighlightTimeoutRef = useRef(null);
  const isDirectConversation = activeContact?.type === 'direct' && Boolean(activeContact?.conversationId);
  const canOpenActiveProfile = activeContact?.type === 'direct' && Boolean(activeContact?.contactUserId);
  const headerAvatar = activeContact?.avatar || activeContact?.avatarUrl || defaultAvatar;
  const activeConversationKey = isDirectConversation
    ? `direct-${activeContact.conversationId}`
    : `group-${activeContact?.id || GLOBAL_CONTACT.id}`;
  const isConversationPinned = pinnedConversationKeys.has(activeConversationKey);
  const isSearchForActiveConversation = searchPanelConversationKey === activeConversationKey;
  const isSearchPanelVisible = isSearchPanelOpen && isSearchForActiveConversation;
  const searchTermForActiveConversation = isSearchForActiveConversation ? messageSearchTerm : '';
  const normalizedSearchTerm = searchTermForActiveConversation.trim().toLowerCase();

  const searchedMessages = useMemo(() => {
    if (!normalizedSearchTerm) return messages;
    return messages.filter((msg) => (msg.text || '').toLowerCase().includes(normalizedSearchTerm));
  }, [messages, normalizedSearchTerm]);
  const mostRecentOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].user === currentUser.username) {
        return messages[i].id;
      }
    }
    return null;
  }, [currentUser.username, messages]);

  const searchResults = useMemo(() => {
    return searchedMessages
      .slice()
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
      .map((msg) => {
        const fromCurrentUser = msg.user === currentUser.username;
        const fallbackAvatar = fromCurrentUser
          ? currentUser.avatarUrl || defaultAvatar
          : (activeContact.avatar || activeContact.avatarUrl || defaultAvatar);
        const avatar = msg.avatar || msg.avatarUrl || fallbackAvatar;

        return {
          id: msg.id,
          avatar,
          lastLogin: msg.userLastLogin || (fromCurrentUser ? currentUser.lastLogin : activeContact.lastLogin) || null,
          username: msg.user || 'Unknown',
          text: msg.text || '',
          relativeTime: formatRelativeTime(msg.timestamp)
        };
      });
  }, [
    activeContact.avatar,
    activeContact.avatarUrl,
    activeContact.lastLogin,
    currentUser.avatarUrl,
    currentUser.lastLogin,
    currentUser.username,
    searchedMessages
  ]);
  const collapseSeenReceiptsToLatest = (messageList) => {
    const latestSeenByUser = new Map();
    const cloned = messageList.map((msg) => ({ ...msg, seenByUsers: [] }));

    messageList.forEach((msg, index) => {
      const seenByUsers = Array.isArray(msg.seenByUsers) ? msg.seenByUsers : [];
      seenByUsers.forEach((viewer) => {
        if (!viewer?.userId) return;
        latestSeenByUser.set(String(viewer.userId), { index, viewer });
      });
    });

    latestSeenByUser.forEach(({ index, viewer }) => {
      if (!cloned[index]) return;
      cloned[index].seenByUsers.push(viewer);
      cloned[index].status = 'seen';
    });

    return cloned;
  };

  const fetchMessagePage = useCallback(async (beforeMessage = null) => {
    const params = new URLSearchParams();
    params.set('limit', String(MESSAGE_PAGE_SIZE));
    if (isDirectConversation) {
      params.set('userId', String(currentUser.id));
    }
    if (beforeMessage?.timestamp && beforeMessage?.id) {
      params.set('beforeTs', String(beforeMessage.timestamp));
      params.set('beforeId', String(beforeMessage.id));
    }

    const endpoint = isDirectConversation
      ? `${import.meta.env.VITE_API_URL}/api/conversations/${activeContact.conversationId}/messages?${params.toString()}`
      : `${import.meta.env.VITE_API_URL}/api/conversations/global/messages?${params.toString()}`;

    const response = await fetch(endpoint);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to load messages.');
    }

    const incoming = Array.isArray(data.messages) ? data.messages : [];
    return {
      messages: incoming
        .map((msg) => ({
          ...msg,
          seenByUsers: Array.isArray(msg.seenByUsers) ? msg.seenByUsers : []
        }))
        .sort((a, b) => a.timestamp - b.timestamp),
      hasMore: Boolean(data.hasMore)
    };
  }, [activeContact.conversationId, currentUser.id, isDirectConversation]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreBefore || messages.length === 0) return;
    const chatBody = chatBodyRef.current;
    if (!chatBody) return;

    setLoadingOlder(true);
    try {
      const oldestMessage = messages[0];
      prependScrollRef.current = {
        previousHeight: chatBody.scrollHeight,
        previousTop: chatBody.scrollTop
      };

      const page = await fetchMessagePage(oldestMessage);
      if (!page.messages.length) {
        setHasMoreBefore(false);
        prependScrollRef.current = null;
        return;
      }

      shouldAutoScrollRef.current = false;
      setHasMoreBefore(page.hasMore);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => String(m.id)));
        const olderOnly = page.messages.filter((m) => !existing.has(String(m.id)));
        return [...olderOnly, ...prev];
      });
    } catch {
      prependScrollRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchMessagePage, hasMoreBefore, isLoadingOlder, messages]);

  useEffect(() => {
    const applySeenUpdate = (previous, payload) => {
      if (!payload?.viewer?.userId) {
        return previous.map((msg) => (String(msg.id) === String(payload.id) ? { ...msg, status: payload.status } : msg));
      }

      const normalizedViewer = {
        userId: String(payload.viewer.userId),
        username: payload.viewer.username || 'Unknown',
        avatarUrl: payload.viewer.avatarUrl || null,
        lastLogin: payload.viewer.lastLogin || null
      };

      const removedPreviousSeen = previous.map((msg) => {
        const existingSeen = Array.isArray(msg.seenByUsers) ? msg.seenByUsers : [];
        const filteredSeen = existingSeen.filter((viewer) => String(viewer.userId) !== normalizedViewer.userId);
        if (filteredSeen.length === existingSeen.length) {
          return msg;
        }
        return { ...msg, seenByUsers: filteredSeen };
      });

      return removedPreviousSeen.map((msg) => {
        if (String(msg.id) !== String(payload.id)) {
          return msg;
        }

        const existingSeen = Array.isArray(msg.seenByUsers) ? msg.seenByUsers : [];
        return {
          ...msg,
          status: payload.status || 'seen',
          seenByUsers: [...existingSeen, normalizedViewer]
        };
      });
    };

    const onReceiveMessage = (newMessage) => {
      const incomingIsDirect = Boolean(newMessage.conversationId);
      if (isDirectConversation) {
        if (Number(newMessage.conversationId) !== Number(activeContact.conversationId)) {
          return;
        }
      } else if (incomingIsDirect) {
        return;
      }

      if (newMessage.user !== currentUser.username) {
        socket.emit('message-seen', {
          id: newMessage.id,
          conversationId: incomingIsDirect ? newMessage.conversationId : null,
          viewer: {
            userId: currentUser.id,
            username: currentUser.username,
            avatarUrl: currentUser.avatarUrl || null,
            lastLogin: currentUser.lastLogin || null
          }
        });
      }
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          ...newMessage,
          seenByUsers: Array.isArray(newMessage.seenByUsers) ? newMessage.seenByUsers : []
        }
      ]);
    };

    const onStatusChanged = (payload) => {
      const eventIsDirect = Boolean(payload?.conversationId);
      if (isDirectConversation) {
        if (Number(payload?.conversationId) !== Number(activeContact?.conversationId)) {
          return;
        }
      } else if (eventIsDirect) {
        return;
      }

      setMessages((prevMessages) => applySeenUpdate(prevMessages, payload));
    };

    socket.on('receive-message', onReceiveMessage);
    socket.on('message-status-changed', onStatusChanged);

    return () => {
      socket.off('receive-message', onReceiveMessage);
      socket.off('message-status-changed', onStatusChanged);
    };
  }, [activeContact?.conversationId, currentUser.avatarUrl, currentUser.id, currentUser.lastLogin, currentUser.username, isDirectConversation]);

  useEffect(() => {
    let isActive = true;

    const loadInitialPage = async () => {
      try {
        const page = await fetchMessagePage();
        if (!isActive) return;

        const collapsedMessages = collapseSeenReceiptsToLatest(page.messages);
        shouldAutoScrollRef.current = true;
        prependScrollRef.current = null;
        setHasMoreBefore(page.hasMore);
        setMessages(collapsedMessages);

        const currentUserId = String(currentUser.id);
        collapsedMessages.forEach((msg) => {
          if (msg.user === currentUser.username) return;
          const seenByUsers = Array.isArray(msg.seenByUsers) ? msg.seenByUsers : [];
          const alreadySeenByCurrentUser = seenByUsers.some((viewer) => String(viewer.userId) === currentUserId);
          if (alreadySeenByCurrentUser) return;

          socket.emit('message-seen', {
            id: msg.id,
            conversationId: isDirectConversation ? activeContact.conversationId : null,
            viewer: {
              userId: currentUser.id,
              username: currentUser.username,
              avatarUrl: currentUser.avatarUrl || null,
              lastLogin: currentUser.lastLogin || null
            }
          });
        });
      } catch {
        // Ignore load errors for now
      }
    };

    loadInitialPage();

    return () => {
      isActive = false;
    };
  }, [activeContact?.conversationId, currentUser.avatarUrl, currentUser.id, currentUser.lastLogin, currentUser.username, fetchMessagePage, isDirectConversation]);

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(Array.from(pinnedConversationKeys)));
    } catch {
      // Ignore storage errors.
    }
  }, [pinnedConversationKeys]);

  useEffect(() => {
    if (!isSearchPanelVisible) return;
    searchInputRef.current?.focus();
  }, [isSearchPanelVisible]);

  useEffect(() => {
    return () => {
      if (clearHighlightTimeoutRef.current) {
        clearTimeout(clearHighlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody) return;

    const onScroll = () => {
      if (chatBody.scrollTop <= 40) {
        loadOlderMessages();
      }
    };

    chatBody.addEventListener('scroll', onScroll);
    return () => {
      chatBody.removeEventListener('scroll', onScroll);
    };
  }, [loadOlderMessages]);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody) return;

    if (prependScrollRef.current) {
      const { previousHeight, previousTop } = prependScrollRef.current;
      const delta = chatBody.scrollHeight - previousHeight;
      chatBody.scrollTop = previousTop + delta;
      prependScrollRef.current = null;
      return;
    }

    if (shouldAutoScrollRef.current) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
    shouldAutoScrollRef.current = true;
  }, [messages]);

  const sendMessage = () => {
    if (inputValue.trim()) {
      socket.emit('send-message', {
        user: currentUser.username,
        userId: currentUser.id,
        text: inputValue,
        timestamp: Date.now(),
        conversationId: isDirectConversation ? activeContact.conversationId : null
      });
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleCallClick = () => {
    // Placeholder for future voice-call feature.
  };

  const handleVideoClick = () => {
    // Placeholder for future video-call feature.
  };

  const handleToggleChatInfo = () => {
    setChatInfoOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSearchPanelOpen(false);
        setSearchPanelConversationKey(null);
        setMessageSearchTerm('');
      }
      return next;
    });
  };

  const handleTogglePinnedConversation = () => {
    setPinnedConversationKeys((prev) => {
      const next = new Set(prev);
      if (next.has(activeConversationKey)) {
        next.delete(activeConversationKey);
      } else {
        next.add(activeConversationKey);
      }
      return next;
    });
  };

  const handleSearchMessageClick = () => {
    setSearchPanelOpen(true);
    setSearchPanelConversationKey(activeConversationKey);
  };

  const handleCloseSearchPanel = () => {
    setSearchPanelOpen(false);
    setSearchPanelConversationKey(null);
    setMessageSearchTerm('');
  };

  const handleOpenActiveProfile = () => {
    if (!canOpenActiveProfile) return;
    onOpenProfile?.(activeContact.contactUserId);
  };

  const handleSearchResultClick = (messageId) => {
    const targetNode = messageNodeMapRef.current.get(messageId);
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    if (clearHighlightTimeoutRef.current) {
      clearTimeout(clearHighlightTimeoutRef.current);
    }
    clearHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1400);
  };

  const dateGroups = messages.reduce((groups, msg) => {
    const dateKey = new Date(msg.timestamp).toDateString();
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.dateKey !== dateKey) {
      groups.push({ dateKey, messages: [msg] });
    } else {
      lastGroup.messages.push(msg);
    }

    return groups;
  }, []);

  return (
    <section id="message" className="page active">
      <div className="message-layout">
        <ContactList
          onContactSelect={setActiveContact}
          currentUser={currentUser}
          preselectedContact={preselectedContact}
          pinnedConversationKeys={pinnedConversationKeys}
        />

        <div className="chat-center">
          <div className="chat-area">
            <div className="chat-header">
              {canOpenActiveProfile ? (
                <button
                  type="button"
                  className="chat-header-contact"
                  onClick={handleOpenActiveProfile}
                  aria-label={`Open ${activeContact.name || 'user'} profile`}
                >
                  <AvatarWithStatus
                    src={headerAvatar}
                    alt={`${activeContact.name || 'User'} avatar`}
                    className="chat-header-avatar"
                    wrapperClassName="chat-header-avatar-wrap"
                    lastLogin={activeContact.lastLogin}
                  />
                  <span className="chat-header-name"><b>{activeContact.name}</b></span>
                </button>
              ) : (
                <div className="chat-header-contact-static">
                  <AvatarWithStatus
                    src={headerAvatar}
                    alt={`${activeContact.name || 'Chat'} avatar`}
                    className="chat-header-avatar"
                    wrapperClassName="chat-header-avatar-wrap"
                    lastLogin={activeContact.lastLogin}
                  />
                  <span className="chat-header-name"><b>{activeContact.name}</b></span>
                </div>
              )}
              <div className="chat-actions">
                <button
                  type="button"
                  className="chat-action-btn"
                  aria-label="Start voice call"
                  onClick={handleCallClick}
                >
                  <i className="fas fa-phone" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  className="chat-action-btn"
                  aria-label="Start video call"
                  onClick={handleVideoClick}
                >
                  <i className="fas fa-video" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  className={`chat-action-btn ${isChatInfoOpen ? 'active' : ''}`.trim()}
                  aria-label="Toggle chat info"
                  aria-pressed={isChatInfoOpen}
                  onClick={handleToggleChatInfo}
                >
                  <i className="fas fa-ellipsis" aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <div className="chat-body" ref={chatBodyRef}>
              {dateGroups.map((group) => (
                <div className="date-group" key={group.dateKey}>
                  <DateDivider timestamp={group.messages[0].timestamp} />
                  {group.messages.map((msg, index) => {
                    const prevMsg = group.messages[index - 1];
                    const isContinuous =
                      prevMsg &&
                      prevMsg.user === msg.user &&
                      (msg.timestamp - prevMsg.timestamp) < GROUP_TIME;

                    return (
                      <div
                        key={msg.id}
                        ref={(node) => {
                          if (node) {
                            messageNodeMapRef.current.set(msg.id, node);
                          } else {
                            messageNodeMapRef.current.delete(msg.id);
                          }
                        }}
                        className={`message-search-target ${highlightedMessageId === msg.id ? 'active' : ''}`.trim()}
                      >
                        <Message
                          msg={msg}
                          username={currentUser.username}
                          isContinuous={isContinuous}
                          isMostRecentOwnMessage={mostRecentOwnMessageId !== null && String(msg.id) === String(mostRecentOwnMessageId)}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="chat-input">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
            />
            <button type="button" className="chat-send-btn" onClick={sendMessage} aria-label="Send message">
              <i className="fas fa-paper-plane" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {isChatInfoOpen && (
          <div className="chat-info">
            {isSearchPanelVisible ? (
              <div className="chat-info-search-panel">
                <div className="chat-info-search-header">
                  <button
                    type="button"
                    className="chat-info-search-back"
                    onClick={handleCloseSearchPanel}
                    aria-label="Back"
                  >
                    <i className="fas fa-arrow-left" aria-hidden="true"></i>
                  </button>
                  <div className="chat-info-search-bar">
                    <i className="fas fa-search" aria-hidden="true"></i>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search in conversation..."
                      value={searchTermForActiveConversation}
                      onChange={(e) => {
                        setSearchPanelConversationKey(activeConversationKey);
                        setMessageSearchTerm(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="chat-info-search-meta">
                  {normalizedSearchTerm
                    ? `${searchResults.length} matching message${searchResults.length === 1 ? '' : 's'}`
                    : 'Type to search messages'}
                </div>
                <div className="chat-info-search-results">
                  {normalizedSearchTerm && searchResults.length === 0 && (
                    <div className="no-results">No matching messages.</div>
                  )}
                  {!normalizedSearchTerm && (
                    <div className="no-results">Search messages to see results.</div>
                  )}
                  {searchResults.map((item) => (
                    <button
                      type="button"
                      className="chat-search-result-card"
                      key={item.id}
                      onClick={() => handleSearchResultClick(item.id)}
                    >
                      <AvatarWithStatus
                        src={item.avatar}
                        alt={`${item.username} avatar`}
                        className="chat-search-result-avatar"
                        wrapperClassName="chat-search-result-avatar-wrap"
                        lastLogin={item.lastLogin}
                      />
                      <div className="chat-search-result-content">
                        <div className="chat-search-result-top">
                          <div className="chat-search-result-username">{item.username}</div>
                          <div className="chat-search-result-time">{item.relativeTime}</div>
                        </div>
                        <div className="chat-search-result-message">{item.text}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="chat-info-profile">
                  <AvatarWithStatus
                    src={headerAvatar}
                    alt={`${activeContact.name || 'Chat'} avatar`}
                    className="chat-info-avatar"
                    wrapperClassName="chat-info-avatar-wrap"
                    lastLogin={activeContact.lastLogin}
                  />
                  <h3 className="chat-info-name">{activeContact.name || 'Unknown'}</h3>
                </div>

                <div className="chat-info-actions" role="group" aria-label="Conversation actions">
                  <button
                    type="button"
                    className={`chat-info-action ${isConversationPinned ? 'active' : ''}`.trim()}
                    onClick={handleTogglePinnedConversation}
                    aria-label={isConversationPinned ? 'Unpin conversation' : 'Pin conversation'}
                    aria-pressed={isConversationPinned}
                  >
                    <span className="chat-info-action-icon">
                      <i className={`fas ${isConversationPinned ? 'fa-ban' : 'fa-thumbtack'}`} aria-hidden="true"></i>
                    </span>
                    <span className="chat-info-action-label">{isConversationPinned ? 'Unpin' : 'Pin'}</span>
                  </button>

                  <button
                    type="button"
                    className="chat-info-action"
                    onClick={handleSearchMessageClick}
                    aria-label="Search messages"
                  >
                    <span className="chat-info-action-icon">
                      <i className="fas fa-search" aria-hidden="true"></i>
                    </span>
                    <span className="chat-info-action-label">Search</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default Messenger;
