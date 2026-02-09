import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Message from './Message';
import DateDivider from './DateDivider';
import ContactList from './ContactList'; // 1. Import the new component

const socket = io(import.meta.env.VITE_API_URL);
const GROUP_TIME = 2 * 60 * 1000;

function Messenger({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [activeContact, setActiveContact] = useState({ name: 'Global Chat' }); 
  const chatBodyRef = useRef(null);

  // 2. REMOVE the random username generator. We will use the prop instead.
  // const username = useRef("User-" + Math.floor(Math.random() * 1000)).current;

  useEffect(() => {
    const onReceiveMessage = (newMessage) => {
      // 3. Use the prop for checking incoming messages
      if (newMessage.user !== currentUser.username) {
        socket.emit('message-seen', { id: newMessage.id });
      }
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    };

    const onStatusChanged = ({ id, status }) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
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
    // Add currentUser.username to the dependency array
  }, [currentUser.username]); 

  useEffect(() => {
    let isActive = true;

    const loadMessages = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/conversations/global/messages`);
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        if (!isActive) return;

        const incoming = Array.isArray(data.messages) ? data.messages : [];
        setMessages(prev => {
          const byId = new Map();
          prev.forEach(m => byId.set(m.id, m));
          incoming.forEach(m => byId.set(m.id, m));
          return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
        });
      } catch {
        // Ignore load errors for now
      }
    };

    loadMessages();

    return () => {
      isActive = false;
    };
  }, [currentUser.id, currentUser.username]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (inputValue.trim()) {
      socket.emit("send-message", {
        user: currentUser.username, 
        userId: currentUser.id,
        text: inputValue,
        timestamp: Date.now()
      });
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <section id="message" className="page active">
      <div className="message-layout">
        {/* 3. Replace the old div with the new component */}
        <ContactList onContactSelect={setActiveContact} />

        <div className="chat-area">
          <div className="chat-header">
            {/* 4. Make the header dynamic */}
            <span>{activeContact.name}</span> 
            <div className="chat-actions">📞 🎥 ⋯</div>
          </div>
          <div className="chat-body" ref={chatBodyRef}>
            {/* ... (message rendering logic) ... */}
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1];

              // Logic for Date Divider
              const showDateDivider = !prevMsg || 
                new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
              
              // Logic for Message Grouping
              const isContinuous = prevMsg &&
                prevMsg.user === msg.user &&
                (msg.timestamp - prevMsg.timestamp) < GROUP_TIME;

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && <DateDivider timestamp={msg.timestamp} />}
                  <Message
                    msg={msg}
                    username={currentUser.username}
                    isContinuous={isContinuous}
                  />
                </React.Fragment>
              );
            })}
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

        <div className="chat-info">
          <h3>Chat Info</h3>
          <button>Search message</button>
          <p>Recent images</p>
        </div>
      </div>
    </section>
  );
}

export default Messenger;
