import { React, useState } from 'react';
import ContactItem from './ContactItem';

// 1. Define the default Global Chat object
const globalChat = {
  id: 'global-chat-01',
  name: 'Global Chat',
  avatar: 'https://i.pravatar.cc/150?u=global', // A generic avatar for the group
  lastMessage: 'Welcome to the chat!',
  type: 'group' // Add a type for future use
};

function ContactList({ onContactSelect }) {
  // 2. The initial state for contacts is now just the global chat
  const [contacts, setContacts] = useState([globalChat]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 3. The active contact is the global chat by default
  const [activeContactId, setActiveContactId] = useState(globalChat.id);

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
        <input
          type="text"
          placeholder="Search for people or groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="contact-list-items">
        {filteredContacts.map(contact => (
          <ContactItem
            key={contact.id}
            contact={contact}
            isActive={contact.id === activeContactId}
            onClick={handleContactClick}
          />
        ))}
        {/* This area will be empty until you add more contacts */}
        {filteredContacts.length === 0 && (
          <div className="no-results">No contacts found.</div>
        )}
      </div>
    </div>
  );
}

export default ContactList;