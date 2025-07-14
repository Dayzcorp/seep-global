import React, { useState } from 'react';

export default function Settings({ onClose }) {
  const [botName, setBotName] = useState(sessionStorage.getItem('botName') || 'SEEP');
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('apiKey') || '');

  const save = () => {
    sessionStorage.setItem('botName', botName);
    sessionStorage.setItem('apiKey', apiKey);
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
          OpenRouter API key
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </label>
        <label>
          Model
          <select disabled>
            <option value="deepseek/deepseek-chat-v3-0324:free">deepseek/deepseek-chat-v3-0324:free</option>
          </select>
        </label>
        <button onClick={save}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
