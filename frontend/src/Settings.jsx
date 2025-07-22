import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Settings({ onClose }) {
  const botName = 'Seep';
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/bot/${botName}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setWelcome(data.welcomeMessage || ''));
  }, []);

  const save = async () => {
    await fetch(`${API_BASE}/bot/${botName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ welcomeMessage: welcome })
    });
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Settings</h2>
        <label>
          Welcome message
          <input
            className="border p-2 mt-1"
            placeholder="Enter welcome message..."
            value={welcome}
            onChange={e => setWelcome(e.target.value)}
          />
        </label>
        <button onClick={save}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
