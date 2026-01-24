import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');

        if (!sessionId) {
          toast.error('Invalid session');
          navigate('/');
          return;
        }

        const response = await api.get('/auth/session-data', {
          headers: { 'X-Session-ID': sessionId },
        });

        localStorage.setItem('user', JSON.stringify(response.data));
        toast.success('Login successful!');
        navigate('/dashboard', { state: { user: response.data }, replace: true });
      } catch (error) {
        toast.error('Authentication failed');
        navigate('/');
      }
    };

    processSession();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Authenticating...</div>
    </div>
  );
};

export default AuthCallback;