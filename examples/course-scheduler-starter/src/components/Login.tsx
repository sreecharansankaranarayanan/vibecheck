// PROVIDED — do not modify.
// A working login form is given so you can start on the scheduler immediately.
// Credentials: student / cs2026

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
      <div style={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8, padding: 40, width: 360, color: '#e2e8f0' }}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>📚</div>
        <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 4 }}>Course Scheduler</h1>
        <p style={{ textAlign: 'center', color: '#8892b0', marginBottom: 28, fontSize: 13 }}>Sign in to manage your semester</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="username" style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8892b0', marginBottom: 6 }}>Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="student"
              data-testid="username-input"
              style={{ width: '100%', padding: '10px 12px', background: '#22263a', border: '1px solid #2e3250', borderRadius: 6, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8892b0', marginBottom: 6 }}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              data-testid="password-input"
              style={{ width: '100%', padding: '10px 12px', background: '#22263a', border: '1px solid #2e3250', borderRadius: 6, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {error && <p data-testid="login-error" style={{ color: '#ef5350', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button
            type="submit"
            data-testid="login-button"
            style={{ width: '100%', background: '#64b5f6', color: '#0f1117', fontWeight: 600, border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
          >
            Sign In
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#8892b0', fontSize: 12, marginTop: 16 }}>
          Demo credentials: <code style={{ background: '#22263a', padding: '1px 5px', borderRadius: 3 }}>student</code> / <code style={{ background: '#22263a', padding: '1px 5px', borderRadius: 3 }}>cs2026</code>
        </p>
      </div>
    </div>
  );
}
