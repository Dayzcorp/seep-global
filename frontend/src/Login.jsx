import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from './Settings';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch (e) {}
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed');
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto bg-white/80 backdrop-blur-md rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit" className="bg-indigo-500 text-white px-4 py-2 rounded w-full">Login</button>
      </form>
      <div className="text-sm mt-2">
        <Link to="/signup" className="text-indigo-600">New here? Sign up instead</Link>
      </div>
      <div className="text-sm mt-1">
        <span className="text-indigo-600 cursor-pointer">Forgot password?</span>
      </div>
    </div>
  );
}
