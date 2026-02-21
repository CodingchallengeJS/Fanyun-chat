import React from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';
import AvatarWithStatus from '../Common/AvatarWithStatus';

// Helper function to format time
const formatTime = (ts) => {
  const d = new Date(ts);
  const vietnamTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vietnamTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function Message({ msg, username, isContinuous, isMostRecentOwnMessage }) {
  const isMe = msg.user === username;
  const seenByUsers = Array.isArray(msg.seenByUsers) ? msg.seenByUsers : [];
  const shouldShowSeenReceipts = isMe && seenByUsers.length > 0;
  const shouldShowStatus = isMe && isMostRecentOwnMessage && !shouldShowSeenReceipts;

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
      
      {shouldShowStatus && <div className="status">{msg.status || 'sent'}</div>}
      {shouldShowSeenReceipts && (
        <div className="seen-receipts" aria-label="Seen by">
          {seenByUsers.map((viewer) => (
            <AvatarWithStatus
              key={viewer.userId}
              src={viewer.avatarUrl || defaultAvatar}
              alt={`${viewer.username || 'User'} seen`}
              className="seen-receipt-avatar"
              wrapperClassName="seen-receipt-avatar-wrap"
              lastLogin={viewer.lastLogin}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Message;
