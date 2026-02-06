// src/components/Messenger/Messenger.jsx

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// --- VERIFY THESE IMPORTS ---
// These paths should now be relative to the current folder
import Message from './Message'; 
import DateDivider from './DateDivider';
// --- END OF UPDATES ---

const socket = io("http://localhost:8000");
const GROUP_TIME = 2 * 60 * 1000;

function Messenger() {
  // ... rest of your component code remains exactly the same
  // No other changes are needed in this file
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatBodyRef = useRef(null);
  const username = useRef("User-" + Math.floor(Math.random() * 1000)).current;

  useEffect(() => {
    // === LISTENERS SETUP ===
    const onReceiveMessage = (newMessage) => {
      // If the message is from another user, emit a 'seen' event
      if (newMessage.user !== username) {
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
  }, [username]); // Rerun effect if username were to change

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (inputValue.trim()) {
      socket.emit("send-message", {
        user: username,
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
        <div className="chat-list">
          {/* ... */}
        </div>
        <div className="chat-area">
          <div className="chat-header">
            <span>Global Chat</span>
            <div className="chat-actions">📞 🎥 ⋯</div>
          </div>
          <div className="chat-body" ref={chatBodyRef}>
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
                    username={username}
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
          {/* ... */}
        </div>
      </div>
    </section>
  );
}
export default Messenger;