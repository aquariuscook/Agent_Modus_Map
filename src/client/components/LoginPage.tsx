import React, { useState } from 'react';
import { LogoWithText } from './Logo';

interface LoginPageProps {
  onLogin: (user: { name: string; email: string }) => void;
  onSkip: () => void;
}

type View = 'signin' | 'signup' | 'forgot';

export function LoginPage({ onLogin, onSkip }: LoginPageProps) {
  const [view, setView] = useState<View>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignIn = () => {
    onLogin({ name: 'Demo User', email: 'demo@agentmodus.com' });
  };

  const handleSignUp = () => {
    onLogin({ name: 'New User', email: 'new@agentmodus.com' });
  };

  const handleForgotPassword = () => {
    console.log('Password reset requested');
  };

  const handleGoogleLogin = () => {
    console.log('Google login');
  };

  const handleGithubLogin = () => {
    console.log('GitHub login');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'var(--font-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  };

  const fieldGroupStyle: React.CSSProperties = {
    marginBottom: 16,
  };

  const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 0',
    background: 'var(--accent-primary)',
    color: '#0f172a',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.1s',
  };

  const socialButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 0',
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'background 0.2s, border-color 0.2s',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const renderPasswordField = (label: string, show: boolean, toggle: () => void) => (
    <div style={fieldGroupStyle}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          placeholder="Enter password"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={toggle}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-primary)',
          }}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );

  const renderSocialButtons = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-default)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={socialButtonStyle} onClick={handleGoogleLogin}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <button style={socialButtonStyle} onClick={handleGithubLogin}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
          Continue with GitHub
        </button>
      </div>
    </>
  );

  const renderSignIn = () => (
    <div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Email</label>
        <input type="email" placeholder="you@example.com" style={inputStyle} />
      </div>
      {renderPasswordField('Password', showPassword, () => setShowPassword(!showPassword))}
      <div style={{ textAlign: 'right', marginBottom: 20 }}>
        <button
          onClick={() => setView('forgot')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-primary)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Forgot password?
        </button>
      </div>
      <button style={primaryButtonStyle} onClick={handleSignIn}>
        Sign In
      </button>
      {renderSocialButtons()}
    </div>
  );

  const renderSignUp = () => (
    <div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Name</label>
        <input type="text" placeholder="Your full name" style={inputStyle} />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Email</label>
        <input type="email" placeholder="you@example.com" style={inputStyle} />
      </div>
      {renderPasswordField('Password', showPassword, () => setShowPassword(!showPassword))}
      {renderPasswordField('Confirm Password', showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
      <button style={primaryButtonStyle} onClick={handleSignUp}>
        Sign Up
      </button>
      {renderSocialButtons()}
    </div>
  );

  const renderForgotPassword = () => (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
        Enter your email and we'll send you a link to reset your password.
      </p>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Email</label>
        <input type="email" placeholder="you@example.com" style={inputStyle} />
      </div>
      <button style={primaryButtonStyle} onClick={handleForgotPassword}>
        Send Reset Link
      </button>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={() => setView('signin')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-primary)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Back to sign in
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-primary)',
      zIndex: 9999,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        padding: '0 20px',
      }}>
        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 16,
          padding: '36px 32px 28px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
            <LogoWithText size={44} />
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: 13,
              marginTop: 10,
              marginBottom: 0,
            }}>
              Design AI agent teams that work together
            </p>
          </div>

          {view !== 'forgot' ? (
            <>
              {/* Tabs */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-default)',
                marginBottom: 24,
                marginTop: 20,
              }}>
                <button
                  style={tabStyle(view === 'signin')}
                  onClick={() => setView('signin')}
                >
                  Sign In
                </button>
                <button
                  style={tabStyle(view === 'signup')}
                  onClick={() => setView('signup')}
                >
                  Sign Up
                </button>
              </div>

              {view === 'signin' ? renderSignIn() : renderSignUp()}
            </>
          ) : (
            <>
              <h3 style={{
                color: 'var(--text-primary)',
                fontSize: 18,
                fontWeight: 600,
                textAlign: 'center',
                margin: '20px 0 8px',
              }}>
                Reset Password
              </h3>
              {renderForgotPassword()}
            </>
          )}
        </div>

        {/* Skip link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Continue without account
          </button>
        </div>
      </div>
    </div>
  );
}
