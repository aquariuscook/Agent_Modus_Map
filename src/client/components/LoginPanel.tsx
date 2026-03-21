import React, { useState } from 'react';
import { loginApi, setAuthToken } from '../api.js';
import type { AuthToken } from '../api.js';

interface Props {
  onLogin: (auth: AuthToken) => void;
  onSkip: () => void;
}

export function LoginPanel({ onLogin, onSkip }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = await loginApi(email, password);
      setAuthToken(auth.token);
      onLogin(auth);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0a1628 0%, #1a1f3a 50%, #0a1628 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(0, 217, 255, 0.3)',
        borderRadius: 16, padding: 32, width: 360, maxWidth: '90%',
      }}>
        <h1 style={{ color: '#00d9ff', fontSize: 22, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 }}>
          Agent Modus
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>Sign in to collaborate</p>

        <form onSubmit={handleLogin}>
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" type="email" autoFocus
            style={inputStyle}
          />
          <input
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" type="password"
            style={{ ...inputStyle, marginTop: 8 }}
          />
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none',
            background: '#00d9ff', color: '#0a1628', fontWeight: 600, fontSize: 14,
            cursor: loading ? 'wait' : 'pointer', marginTop: 16, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button onClick={onSkip} style={{
          width: '100%', padding: '10px 16px', borderRadius: 8, marginTop: 8,
          border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
          color: '#64748b', cursor: 'pointer', fontSize: 13,
        }}>
          Continue as Guest
        </button>

        <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.1)' }}>
          <div style={{ color: '#00d9ff', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Default Accounts</div>
          <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6 }}>
            Admin: admin@agentmodus.local / admin<br />
            Designer: designer@agentmodus.local / designer
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
