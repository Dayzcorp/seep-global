import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function RedirectIfAuthed({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/me`, { credentials: 'include' })
      .then(res => setAuthed(res.ok))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (authed) return <Navigate to="/chat" replace />;
  return children;
}
