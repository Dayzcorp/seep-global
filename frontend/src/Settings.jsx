import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000';

export default function Settings({ onClose }) {
  const [botName, setBotName] = useState(localStorage.getItem('botName') || 'SEEP');
  const [model, setModel] = useState(localStorage.getItem('model') || 'deepseek/deepseek-chat-v3-0324:free');
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/bot/${botName}`)
      .then(res => res.json())
      .then(data => setWelcome(data.welcomeMessage || ''));
  }, [botName]);

  const save = async () => {
    localStorage.setItem('botName', botName);
    localStorage.setItem('model', model);
    await fetch(`${API_BASE}/bot/${botName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ welcomeMessage: welcome })
    });
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Settings</h2>
        <label>
          Bot name
          <input value={botName} onChange={e => setBotName(e.target.value)} />
        </label>
        <label>
          Welcome message
          <input value={welcome} onChange={e => setWelcome(e.target.value)} />
        </label>
        <label>
          Model
          <select value={model} onChange={e => setModel(e.target.value)}>
            <option value="deepseek/deepseek-chat-v3-0324:free">deepseek/deepseek-chat-v3-0324:free</option>
          </select>
        </label>
        <button onClick={save}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
