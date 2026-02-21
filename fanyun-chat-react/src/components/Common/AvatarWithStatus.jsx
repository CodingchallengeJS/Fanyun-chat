import React from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';
import { isOnlineFromLastLogin } from '../../lib/presence';

function AvatarWithStatus({
  src,
  alt,
  className,
  wrapperClassName = '',
  lastLogin = null,
  showStatus = true,
  ringColor
}) {
  const isOnline = showStatus && isOnlineFromLastLogin(lastLogin);
  const wrapperClasses = ['avatar-status-wrap', wrapperClassName].filter(Boolean).join(' ');
  const wrapperStyle = ringColor ? { '--avatar-status-ring-color': ringColor } : undefined;

  return (
    <span className={wrapperClasses} style={wrapperStyle}>
      <img
        src={src || defaultAvatar}
        alt={alt}
        className={className}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = defaultAvatar;
        }}
      />
      {isOnline && <span className="avatar-online-dot" aria-hidden="true" />}
    </span>
  );
}

export default AvatarWithStatus;
