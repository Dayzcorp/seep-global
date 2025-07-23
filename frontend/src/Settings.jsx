import React, { useState, useEffect } from 'react';

export const API_BASE = import.meta.env.VITE_API_BASE;

export default function Settings({ onClose }) {
  const botName = 'Seep';
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/bot/${botName}`, { credentials: 'include' });
        const data = await res.json();
        setWelcome(data.welcomeMessage || '');
      } catch (err) {
        console.error('Load settings error:', err);
      }
    })();
  }, []);

  const save = async () => {
    try {
      await fetch(`${API_BASE}/bot/${botName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ welcomeMessage: welcome })
      });
      onClose();
    } catch (err) {
      console.error('Save settings error:', err);
    }
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
