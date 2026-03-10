import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch current user
  const fetchCurrentUser = useCallback(async (authToken) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setError(null);
      } else {
        // Token invalid, clear it
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

  // Register
  const register = useCallback(async (email, password, fullName) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser({
        id: data.user_id,
        email: data.email,
        full_name: fullName
      });
      localStorage.setItem('authToken', data.access_token);

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  // Login
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser({
        id: data.user_id,
        email: data.email
      });
      localStorage.setItem('authToken', data.access_token);

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  // Logout
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    setError(null);
  }, []);

  // Refresh token
  const refreshToken = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
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
    isAuthenticated: !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
