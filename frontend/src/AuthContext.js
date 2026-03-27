import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { pullProgressFromBackend, pushProgressToBackend } from './progressService';

const AuthContext = createContext(null);

// All localStorage keys that are user-specific and must be cleared on logout
const USER_LOCAL_KEYS = [
  'codetutor_learning_progress',
  'java-roadmap-completed',
  'dismissed_milestones',
  'hasSeenDemoTour',
];

const clearUserLocalData = () => {
  USER_LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
  // Clear any user-scoped chat history keys (pattern: codetutor_chat_<userId>)
  Object.keys(localStorage)
    .filter(k => k.startsWith('codetutor_chat_'))
    .forEach(k => localStorage.removeItem(k));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = useCallback(async (authToken) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setError(null);
      } else {
        localStorage.removeItem('authToken');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const register = useCallback(async (email, password, fullName, role = 'student') => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, role })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }
      const data = await response.json();
      setToken(data.access_token);
      setUser({ id: data.user_id, email: data.email, full_name: fullName, role: data.role });
      localStorage.setItem('authToken', data.access_token);
      try { await pushProgressToBackend(); await pullProgressFromBackend(); } catch (_) {}
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      // Clear any previous user's local data before loading the new user's data
      clearUserLocalData();
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      const data = await response.json();
      setToken(data.access_token);
      setUser({ id: data.user_id, email: data.email, role: data.role });
      localStorage.setItem('authToken', data.access_token);
      try { await pushProgressToBackend(); await pullProgressFromBackend(); } catch (_) {}
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const logout = useCallback(async () => {
    // Push progress to backend before clearing local data
    try { await pushProgressToBackend(); } catch (_) {}
    // Clear all user-specific local storage
    clearUserLocalData();
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    setError(null);
  }, []);

  const refreshToken = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        setUser(prev => prev ? { ...prev, role: data.role } : prev);
        localStorage.setItem('authToken', data.access_token);
        return data.access_token;
      } else {
        logout();
        return null;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
      return null;
    }
  }, [token, API_BASE, logout]);

  const value = {
    user,
    token,
    loading,
    error,
    register,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!token,
    isTeacher: user?.role === 'teacher' || user?.role === 'admin',
    isAdmin:   user?.role === 'admin',
    isStudent: user?.role === 'student',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
