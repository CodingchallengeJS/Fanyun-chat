import React from 'react';

function Sidebar({ onPageChange, onToggleProfile, onToggleSettings }) {
  return (
    <aside className="sidebar">
      <div className="nav-top">
        <button onClick={() => onPageChange('home')}>
          <i className="fas fa-house" aria-hidden="true"></i>
        </button>
        <button onClick={() => onPageChange('message')}>
          <i className="fas fa-comments" aria-hidden="true"></i>
        </button>
        <button onClick={() => onPageChange('contact')}>
          <i className="fas fa-user-group" aria-hidden="true"></i>
        </button>
      </div>
      <div className="nav-bottom">
        <button onClick={onToggleProfile}>
          <i className="fas fa-user" aria-hidden="true"></i>
        </button>
        <button onClick={onToggleSettings}>
          <i className="fas fa-gear" aria-hidden="true"></i>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
