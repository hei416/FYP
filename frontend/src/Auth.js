import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Auth.css';

export const Auth = () => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, fullName, role);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('student');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>☕ CodeTutor</h1>
          <p>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {/* Role selector */}
              <div className="form-group">
                <label>I am a...</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {['student', 'teacher'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 8,
                        border: role === r ? '2px solid #4f46e5' : '2px solid #e5e7eb',
                        background: role === r ? '#eef2ff' : '#fff',
                        color: role === r ? '#4f46e5' : '#6b7280',
                        fontWeight: role === r ? 700 : 400,
                        cursor: 'pointer',
                        fontSize: 15,
                        transition: 'all 0.2s',
                      }}
                    >
                      {r === 'student' ? '🎓 Student' : '🏫 Teacher'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" disabled={loading} className="auth-button">
            {loading
              ? (mode === 'login' ? 'Logging in...' : 'Creating account...')
              : (mode === 'login' ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" onClick={toggleMode} className="toggle-button">
              {mode === 'login' ? 'Register' : 'Login'}
            </button>
          </p>
        </div>

        <div className="auth-guest">
          <button type="button" onClick={() => navigate('/home')} className="guest-button">
            Continue without login →
          </button>
          <p className="guest-note">Progress will be saved locally. Login anytime to back it up.</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
