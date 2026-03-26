import React, { useState, useEffect } from 'react';

interface KeyStatus {
  set: boolean;
  length: number;
  prefix: string;
}

export function SettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<{ anthropic: KeyStatus; tavily: KeyStatus } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { working: boolean; error?: string }> | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings/keys')
        .then(r => r.json())
        .then(d => setKeyStatus(d.data))
        .catch(() => {});
    }
  }, [isOpen]);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const body: Record<string, string> = {};
      if (anthropicKey.trim()) body.anthropicKey = anthropicKey.trim();
      if (tavilyKey.trim()) body.tavilyKey = tavilyKey.trim();

      if (Object.keys(body).length === 0) {
        setMessage('Enter at least one key to save.');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setKeyStatus(prev => ({
        anthropic: { set: data.data.anthropic.set, length: anthropicKey.length || prev?.anthropic.length || 0, prefix: anthropicKey.slice(0, 7) || prev?.anthropic.prefix || '' },
        tavily: { set: data.data.tavily.set, length: tavilyKey.length || prev?.tavily.length || 0, prefix: tavilyKey.slice(0, 4) || prev?.tavily.prefix || '' },
      }));
      setAnthropicKey('');
      setTavilyKey('');
      setMessage('Keys saved and active.');
    } catch {
      setMessage('Failed to save keys. Check your connection.');
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/settings/keys/test', { method: 'POST' });
      const data = await res.json();
      setTestResults(data.data);
    } catch {
      setTestResults({ anthropic: { working: false, error: 'Connection failed' }, tavily: { working: false, error: 'Connection failed' } });
    }
    setTesting(false);
  }

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 16, width: '100%', maxWidth: 520, padding: 32,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)', color: 'var(--text-tertiary)',
            cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>X</button>
        </div>

        {/* Current Status */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Connection Status</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <StatusCard
              name="Anthropic (AI)"
              connected={keyStatus?.anthropic.set || false}
              prefix={keyStatus?.anthropic.prefix}
              testResult={testResults?.anthropic}
            />
            <StatusCard
              name="Tavily (Search)"
              connected={keyStatus?.tavily.set || false}
              prefix={keyStatus?.tavily.prefix}
              testResult={testResults?.tavily}
            />
          </div>
        </div>

        {/* Add/Update Keys */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            {keyStatus?.anthropic.set ? 'Update Keys' : 'Add Your API Keys'}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Anthropic API Key
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                {keyStatus?.anthropic.set ? '(already set, enter new to replace)' : 'Required for live tests'}
              </span>
            </label>
            <input
              type="password"
              value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Get one at console.anthropic.com
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Tavily API Key
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                {keyStatus?.tavily.set ? '(already set, enter new to replace)' : 'Optional, enables web search'}
              </span>
            </label>
            <input
              type="password"
              value={tavilyKey}
              onChange={e => setTavilyKey(e.target.value)}
              placeholder="tvly-..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-primary)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Get a free key at tavily.com (2,000 searches/month)
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving || (!anthropicKey.trim() && !tavilyKey.trim())} style={{
            flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none',
            background: 'var(--accent-primary)', color: 'var(--text-inverse)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-primary)',
            opacity: saving || (!anthropicKey.trim() && !tavilyKey.trim()) ? 0.4 : 1,
          }}>{saving ? 'Saving...' : 'Save Keys'}</button>

          <button onClick={handleTest} disabled={testing} style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid var(--border-default)', background: 'transparent',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: 'var(--font-primary)',
            opacity: testing ? 0.4 : 1,
          }}>{testing ? 'Testing...' : 'Test Connections'}</button>
        </div>

        {/* Message */}
        {message && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-primary)', textAlign: 'center' }}>{message}</div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ name, connected, prefix, testResult }: {
  name: string;
  connected: boolean;
  prefix?: string;
  testResult?: { working: boolean; error?: string };
}) {
  const dotColor = testResult
    ? (testResult.working ? '#22c55e' : '#ef4444')
    : (connected ? '#fbbf24' : 'var(--text-tertiary)');

  const statusText = testResult
    ? (testResult.working ? 'Working' : testResult.error || 'Failed')
    : (connected ? `Set (${prefix}...)` : 'Not configured');

  return (
    <div style={{
      flex: 1, padding: '12px 14px', borderRadius: 10,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{statusText}</div>
    </div>
  );
}
