import React from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';
import AvatarWithStatus from '../Common/AvatarWithStatus';

function ContactItem({ contact, onClick, isActive }) {
  // Conditionally apply the 'active' class
  const itemClasses = `chat-item ${isActive ? 'active' : ''}`;

  return (
    <div className={itemClasses} onClick={() => onClick(contact)}>
      <AvatarWithStatus
        src={contact.avatar || defaultAvatar}
        alt="avatar"
        className="avatar"
        wrapperClassName="chat-item-avatar-wrap"
        lastLogin={contact.lastLogin}
      />
      <div className="contact-details">
        <div className="contact-name">{contact.name}</div>
        <div className="contact-last-message">{contact.lastMessage}</div>
      </div>
    </div>
  );
}

export default ContactItem;
