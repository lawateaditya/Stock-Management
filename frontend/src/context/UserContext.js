import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '@/utils/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // If we have a cached user in localStorage, use it immediately
      const cached = localStorage.getItem('user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (e) {
          // fallthrough to fetch fresh
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await api.get('/auth/me', { signal: controller.signal });
        setUser(response.data);
        // update cache
        try { localStorage.setItem('user', JSON.stringify(response.data)); } catch (e) {}
      } catch (error) {
        console.error('Failed to fetch user:', error);
        // Token might be invalid or request timed out, remove it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};
