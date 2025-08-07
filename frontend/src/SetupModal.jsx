import React, { useState, useEffect } from 'react';
import { API_BASE } from './Settings';

export default function SetupModal({ onClose }) {
  const [welcome, setWelcome] = useState('');
  const [business, setBusiness] = useState('');

  useEffect(() => {
    const domain = window.location.hostname.split('.')[0];
    setBusiness(domain);
  }, []);

  const save = async () => {
    try {
      await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcomeMessage: welcome, businessName: business })
      });
      localStorage.setItem('configSet', 'true');
      onClose();
    } catch (err) {
      console.error('Setup save error:', err);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Welcome to Seep Global</h2>
        <p className="text-sm mb-2">Boost sales, recover carts, and keep customers informed with product-aware AI.</p>
        <label>
          Welcome message
          <input value={welcome} onChange={e => setWelcome(e.target.value)} />
        </label>
        <label>
          Business name
          <input value={business} onChange={e => setBusiness(e.target.value)} />
        </label>
        <button onClick={save}>Save</button>
      </div>
    </div>
  );
}
