import React, { useState } from 'react';
import { API_BASE } from './Settings';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        window.location.href = '/setup';
      } else {
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch (e) {}
        setError(data.error || 'Signup failed');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('Signup failed');
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto bg-white/80 backdrop-blur-md rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Sign Up</h1>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        <button type="submit" className="bg-indigo-500 text-white px-4 py-2 rounded w-full">Create Account</button>
      </form>
    </div>
  );
}
