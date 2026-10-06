import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Lock, User, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const result = await register(username, email, password);
    if (result.success) {
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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join PulseChat for real-time collaboration</p>
        </div>

        {error && <div className="error-alert" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="search-input-wrapper">
              <User size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                minLength={3}
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="search-input-wrapper">
              <Mail size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={18} className="animate-spin" /> Creating Account...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Get Started <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
