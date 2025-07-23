import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { API_BASE } from './Settings';

export default function RedirectIfAuthed({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        setAuthed(res.ok);
      } catch (err) {
        console.error('Auth check error:', err);
        setAuthed(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  if (loading) return null;
  if (authed) return <Navigate to="/chat" replace />;
  return children;
}
