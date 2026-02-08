import React from 'react';

function ContactItem({ contact, onClick, isActive }) {
  // Conditionally apply the 'active' class
  const itemClasses = `chat-item ${isActive ? 'active' : ''}`;

  return (
    <div className={itemClasses} onClick={() => onClick(contact)}>
      <img src={contact.avatar} alt="avatar" className="avatar" />
      <div className="contact-details">
        <div className="contact-name">{contact.name}</div>
        <div className="contact-last-message">{contact.lastMessage}</div>
      </div>
    </div>
  );
}

export default ContactItem;