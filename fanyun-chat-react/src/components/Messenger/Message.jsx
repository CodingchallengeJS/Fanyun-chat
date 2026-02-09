import React from 'react';

// Helper function to format time
const formatTime = (ts) => {
  const d = new Date(ts);
  const vietnamTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vietnamTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// isContinuous prop is added here
function Message({ msg, username, isContinuous }) {
  const isMe = msg.user === username;

  // Add the 'continuous' class if the prop is true
  const messageClasses = `message ${isMe ? 'me' : 'other'} ${isContinuous ? 'continuous' : ''}`;

  return (
    <div className={messageClasses}>
      {/* Show username only if it's not a continuous message */}
      {!isContinuous && !isMe && <div className="username">{msg.user}</div>}

      <div className="bubble-wrapper">
        <div className="bubble">{msg.text}</div>
        <div className="time">{formatTime(msg.timestamp)}</div>
      </div>
      
      {/* Display status from the message object */}
      {isMe && <div className="status">{msg.status}</div>}
    </div>
  );
};

export default Message;