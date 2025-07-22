import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [plan, setPlan] = useState('start');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, plan })
    });
    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      const data = await res.json();
      setError(data.error || 'Signup failed');
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold mb-4">Sign Up</h1>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={submit} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <select className="border p-2 w-full" value={plan} onChange={e => setPlan(e.target.value)}>
          <option value="start">Start</option>
          <option value="grow">Grow</option>
          <option value="pro">Pro</option>
        </select>
        <button type="submit" className="bg-indigo-500 text-white px-4 py-2 rounded w-full">Create Account</button>
      </form>
    </div>
  );
}
