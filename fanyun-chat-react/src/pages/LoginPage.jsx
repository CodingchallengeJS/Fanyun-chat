import React, { useState } from 'react';
import RegisterModal from '../components/Auth/RegisterModal';

function LoginPage({ onLoginSuccess, onGuestLogin }) {
  const [isRegisterOpen, setRegisterOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
        const response = await fetch('http://localhost:8000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to log in.');
        }
        
        // Pass user data up to App.jsx to set the auth state
        onLoginSuccess(data.user);

    } catch (err) {
        setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1 className="app-title">Fanyun Chat</h1>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit">Log In</button>
          {error && <p className="error-message">{error}</p>}
        </form>
        <div className="login-options">
          <span>Don't have an account?</span>
          <a className="link-button" onClick={() => setRegisterOpen(true)}>Register</a>
          <span>now!</span>
        </div>
        <div className="login-options">
          <span>or</span>
          <a className="link-button" onClick={onGuestLogin}>Continue as Guest</a>
        </div>
      </div>
      <RegisterModal isOpen={isRegisterOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}

export default LoginPage;