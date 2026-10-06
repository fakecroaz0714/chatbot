import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const result = await login(loginId, password);
    if (result.success) {
      navigate('/');
    }
  };

  // Quick Demo Auto-login helper: if demo user doesn't exist, automatically registers them!
  const handleQuickDemo = async (username, email, pwd) => {
    clearError();
    let res = await login(username, pwd);
    if (!res.success) {
      // If login failed, auto-register the demo user
      await register(username, email, pwd);
      res = await login(username, pwd);
    }
    if (res.success) {
      navigate('/');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div
            className="brand-icon"
            style={{ width: '48px', height: '48px', margin: '0 auto' }}
          >
            <Zap size={26} />
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your real-time chat workspace</p>
        </div>

        {error && <div className="error-alert" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username or Email</label>
            <div className="search-input-wrapper">
              <User size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                placeholder="e.g. alex or alex@example.com"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="search-input-wrapper">
              <Lock size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={18} className="animate-spin" /> Authenticating...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Sign In <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        <div className="demo-accounts">
          <div className="demo-title">⚡ Instant Demo Accounts (1-Click Test)</div>
          <div className="demo-btns">
            <button
              type="button"
              className="demo-btn"
              onClick={() => handleQuickDemo('Alex', 'alex@example.com', 'password123')}
            >
              👤 Alex
            </button>
            <button
              type="button"
              className="demo-btn"
              onClick={() => handleQuickDemo('Rahul', 'rahul@example.com', 'password123')}
            >
              👤 Rahul
            </button>
            <button
              type="button"
              className="demo-btn"
              onClick={() => handleQuickDemo('Chandru', 'chandru@example.com', 'password123')}
            >
              👤 Chandru
            </button>
          </div>
        </div>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
