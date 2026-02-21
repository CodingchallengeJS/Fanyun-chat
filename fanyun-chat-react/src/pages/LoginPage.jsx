import React, { useState } from 'react';
import RegisterModal from '../components/Auth/RegisterModal';

function LoginPage({ onLoginSuccess, onGuestLogin }) {
  const [isRegisterOpen, setRegisterOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, rememberMe }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to log in.');
        }
        
        onLoginSuccess({
          ...data.user,
          token: data.token || null
        });

    } catch (err) {
        setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro">
          <h1 className="login-hero-title">Fanyun chat</h1>
          <p className="login-hero-subtitle">
            A lightweight, open-source chat app
          </p>
          <p className="login-hero-subtitle">
            For the best experience
          </p>
        </section>

        <section className="login-panel">
          <div className="login-container">
            <h2 className="app-title">Welcome Back</h2>
            <form onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
              <button type="submit">Log In</button>
              {error && <p className="error-message">{error}</p>}
            </form>
            <div className="login-options">
              <span>Don't have an account?</span>
              <button type="button" className="link-button" onClick={() => setRegisterOpen(true)}>Register</button>
              <span>now!</span>
            </div>
            <div className="login-options">
              <span>or</span>
              <button type="button" className="link-button" onClick={onGuestLogin}>Continue as Guest</button>
            </div>
          </div>
        </section>
      </div>

      <footer className="login-footer">
        <p>Made by Quang Trung - a HSGS student</p>
        <p>Powered by React, Node.js, Socket.IO, and PostgreSQL</p>
        <div className="login-contact-links">
          <a href="https://open.spotify.com/user/3164ywju2gbwyop7mkoobpx55umm" target="_blank" rel="noreferrer" aria-label="Spotify">
            <i className="fa-brands fa-spotify" aria-hidden="true"></i>
          </a>
          <a href="https://www.facebook.com/profile.php?id=100089541523808" target="_blank" rel="noreferrer" aria-label="Facebook">
            <i className="fa-brands fa-facebook-f" aria-hidden="true"></i>
          </a>
          <a href="https://discord.com/users/855783911841071115" target="_blank" rel="noreferrer" aria-label="Discord">
            <i className="fa-brands fa-discord" aria-hidden="true"></i>
          </a>
          <a href="https://www.instagram.com/qthsgs2427/" target="_blank" rel="noreferrer" aria-label="Instagram">
            <i className="fa-brands fa-instagram" aria-hidden="true"></i>
          </a>
          <a href="https://zalo.me/0329433161" target="_blank" rel="noreferrer" aria-label="Zalo">
            <i className="fa-solid fa-comment-dots" aria-hidden="true"></i>
          </a>
          <a href="mailto:cscratchhearttuna@gmail.com" aria-label="Email">
            <i className="fa-solid fa-envelope" aria-hidden="true"></i>
          </a>
        </div>
      </footer>
      <RegisterModal isOpen={isRegisterOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}

export default LoginPage;
