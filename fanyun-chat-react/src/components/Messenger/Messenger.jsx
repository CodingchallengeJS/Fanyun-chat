import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Message from './Message';
import DateDivider from './DateDivider';
import ContactList from './ContactList';

const socket = io(import.meta.env.VITE_API_URL);
const GROUP_TIME = 2 * 60 * 1000;
const GLOBAL_CONTACT = { id: 'global-chat-01', name: 'Global Chat', type: 'group' };

function Messenger({ currentUser, preselectedContact }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [activeContact, setActiveContact] = useState(preselectedContact || GLOBAL_CONTACT);
  const [isChatInfoOpen, setChatInfoOpen] = useState(true);
  const chatBodyRef = useRef(null);
  const isDirectConversation = activeContact?.type === 'direct' && Boolean(activeContact?.conversationId);

  useEffect(() => {
    if (preselectedContact?.id) {
      setActiveContact(preselectedContact);
    }
  }, [preselectedContact]);

  useEffect(() => {
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
        socket.emit('message-seen', { id: newMessage.id });
      }
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    };

    const onStatusChanged = ({ id, status }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === id ? { ...msg, status } : msg
        )
      );
    };

    socket.on('receive-message', onReceiveMessage);
    socket.on('message-status-changed', onStatusChanged);

    return () => {
      socket.off('receive-message', onReceiveMessage);
      socket.off('message-status-changed', onStatusChanged);
    };
  }, [activeContact?.conversationId, currentUser.username, isDirectConversation]);

  useEffect(() => {
    let isActive = true;

    const loadMessages = async () => {
      try {
        const endpoint = isDirectConversation
          ? `${import.meta.env.VITE_API_URL}/api/conversations/${activeContact.conversationId}/messages?userId=${currentUser.id}`
          : `${import.meta.env.VITE_API_URL}/api/conversations/global/messages`;

        const response = await fetch(endpoint);
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        if (!isActive) return;

        const incoming = Array.isArray(data.messages) ? data.messages : [];
        setMessages(incoming.sort((a, b) => a.timestamp - b.timestamp));
      } catch {
        // Ignore load errors for now
      }
    };

    loadMessages();

    return () => {
      isActive = false;
    };
  }, [activeContact?.conversationId, currentUser.id, currentUser.username, isDirectConversation]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
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
    setChatInfoOpen((prev) => !prev);
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
        />

        <div className="chat-area">
          <div className="chat-header">
            <span><b>{activeContact.name}</b></span>
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
                    <Message
                      key={msg.id}
                      msg={msg}
                      username={currentUser.username}
                      isContinuous={isContinuous}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage} style={{ width: '15%' }}>Send</button>
          </div>
        </div>

        {isChatInfoOpen && (
          <div className="chat-info">
            <h3>Chat Info</h3>
            <button>Search message</button>
            <p>Recent images</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default Messenger;
