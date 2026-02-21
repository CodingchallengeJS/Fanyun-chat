import React, { useEffect, useState } from 'react';
import ContactItem from './ContactItem';
import defaultAvatar from '../../assets/default-avatar.svg';
import socket from '../../lib/socket';

const GLOBAL_CHAT_ID = 'global-chat-01';

const getConversationKeyFromContact = (contact) => {
  if (contact?.conversationId) return `direct-${contact.conversationId}`;
  if (typeof contact?.id === 'string' && contact.id.startsWith('direct-')) return contact.id;
  return `group-${contact?.id || GLOBAL_CHAT_ID}`;
};

const sortContacts = (list, pinnedConversationKeys = new Set()) => {
  return [...list].sort((a, b) => {
    const aPinned = pinnedConversationKeys.has(getConversationKeyFromContact(a));
    const bPinned = pinnedConversationKeys.has(getConversationKeyFromContact(b));
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;

    return (a.name || '').localeCompare(b.name || '');
  });
};

const getMostRecentContact = (list) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  return [...list].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.name || '').localeCompare(b.name || '');
  })[0];
};

function ContactList({ onContactSelect, currentUser, preselectedContact, pinnedConversationKeys }) {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeContactId, setActiveContactId] = useState(preselectedContact?.id || null);

  useEffect(() => {
    if (!currentUser?.id) return;
    let isActive = true;

    const loadConversations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/conversations`, {
          credentials: 'include',
          headers: currentUser?.token
            ? { Authorization: `Bearer ${currentUser.token}` }
            : undefined
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load conversations.');
        }

        if (!isActive) return;
        const incoming = Array.isArray(data.conversations) ? data.conversations : [];
        const normalized = incoming.map((item) => ({
          ...item,
          avatar: item.avatarUrl || defaultAvatar,
          lastLogin: item.lastLogin || null
        }));

        setContacts((prev) => {
          const byId = new Map();
          normalized.forEach((c) => byId.set(c.id, c));

          // Keep locally-added contacts (e.g., freshly opened direct chat)
          // in case backend list has not reflected them yet.
          prev.forEach((c) => {
            if (!byId.has(c.id)) {
              byId.set(c.id, c);
            }
          });

          const merged = Array.from(byId.values());
          return sortContacts(merged);
        });
      } catch {
        if (!isActive) return;
        // Keep previous contacts on transient fetch errors.
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadConversations();
    return () => {
      isActive = false;
    };
  }, [currentUser?.id, currentUser?.token]);

  useEffect(() => {
    const onReceiveMessage = (message) => {
      setContacts((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;

        const isDirect = Boolean(message.conversationId);
        const targetId = isDirect ? `direct-${message.conversationId}` : GLOBAL_CHAT_ID;

        const messageText = message?.text || '';
        const senderName = message?.user || 'Unknown';
        const lastMessage = messageText ? `${senderName}: ${messageText}` : senderName;

        let changed = false;
        const next = prev.map((contact) => {
          if (contact.id !== targetId) return contact;
          changed = true;
          return {
            ...contact,
            lastMessage,
            updatedAt: message?.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString()
          };
        });

        if (!changed) return prev;
        return sortContacts(next, pinnedConversationKeys);
      });
    };

    socket.on('receive-message', onReceiveMessage);
    return () => socket.off('receive-message', onReceiveMessage);
  }, [pinnedConversationKeys]);

  useEffect(() => {
    if (preselectedContact?.id) {
      setActiveContactId(preselectedContact.id);
      setContacts((prev) => {
        if (prev.some((c) => c.id === preselectedContact.id)) return prev;
        const next = [
          {
            ...preselectedContact,
            avatar: preselectedContact.avatarUrl || defaultAvatar,
            lastLogin: preselectedContact.lastLogin || null,
            lastMessage: preselectedContact.lastMessage || 'No messages yet.'
          },
          ...prev
        ];
        return sortContacts(next, pinnedConversationKeys);
      });
    }
  }, [pinnedConversationKeys, preselectedContact]);

  useEffect(() => {
    setContacts((prev) => sortContacts(prev, pinnedConversationKeys));
  }, [pinnedConversationKeys]);

  useEffect(() => {
    if (contacts.length === 0) return;

    const active = contacts.find((c) => c.id === activeContactId);
    if (active) {
      onContactSelect(active);
      return;
    }

    if (preselectedContact?.id) {
      const preferred = contacts.find((c) => c.id === preselectedContact.id);
      if (preferred) {
        setActiveContactId(preferred.id);
        onContactSelect(preferred);
        return;
      }
    }

    const fallback = getMostRecentContact(contacts) || contacts[0];
    if (fallback) {
      setActiveContactId(fallback.id);
      onContactSelect(fallback);
    }
  }, [activeContactId, contacts, onContactSelect, preselectedContact?.id]);

  const handleContactClick = (contact) => {
    setActiveContactId(contact.id);
    onContactSelect(contact);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="chat-list">
      <div className="search-bar">
        <div className="chat-info-search-bar">
          <i className="fas fa-search" aria-hidden="true"></i>
          <input
            type="text"
            placeholder="Search for people or groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="contact-list-items">
        {isLoading && (
          <div className="no-results">Loading conversations...</div>
        )}
        {filteredContacts.map(contact => (
          <ContactItem
            key={contact.id}
            contact={contact}
            isActive={contact.id === activeContactId}
            onClick={handleContactClick}
          />
        ))}
        {!isLoading && filteredContacts.length === 0 && (
          <div className="no-results">No contacts found.</div>
        )}
      </div>
    </div>
  );
}

export default ContactList;
