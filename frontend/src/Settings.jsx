import React, { useState } from 'react';

export default function Settings({ onClose }) {
  const [botName, setBotName] = useState(localStorage.getItem('botName') || 'SEEP');
  const [model, setModel] = useState(localStorage.getItem('model') || 'deepseek/deepseek-chat-v3-0324:free');

  const save = () => {
    localStorage.setItem('botName', botName);
    localStorage.setItem('model', model);
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
