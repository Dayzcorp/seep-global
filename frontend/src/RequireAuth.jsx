import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { API_BASE } from './Settings';

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        if (res.ok) setAuthed(true);
      } catch (err) {
        console.error('Auth required check error:', err);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  if (loading) return null;
  return authed ? children : <Navigate to="/login" replace />;
}
