import { useState, FormEvent } from 'react';

const MOCK_CREDENTIALS = { username: 'student', password: 'cs2026' };

interface LoginProps {
  onLogin: (username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username === MOCK_CREDENTIALS.username && password === MOCK_CREDENTIALS.password) {
      onLogin(username);
    } else {
      setError('Invalid credentials. Try student / cs2026');
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📚</div>
        <h1>Course Scheduler</h1>
        <p className="login-subtitle">Sign in to manage your semester</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="student"
              autoComplete="username"
              data-testid="username-input"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              data-testid="password-input"
            />
          </div>
          {error && <p className="login-error" data-testid="login-error">{error}</p>}
          <button type="submit" className="btn-primary full-width" data-testid="login-button">
            Sign In
          </button>
        </form>
        <p className="login-hint">Demo credentials: <code>student</code> / <code>cs2026</code></p>
      </div>
    </div>
  );
}
