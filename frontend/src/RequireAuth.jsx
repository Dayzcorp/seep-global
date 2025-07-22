import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/me`, { credentials: 'include' })
      .then(res => {
        if (res.ok) setAuthed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  return authed ? children : <Navigate to="/login" replace />;
}
