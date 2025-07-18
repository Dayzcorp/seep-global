import React, { useState, useEffect } from 'react';

export default function SetupModal({ onClose }) {
  const [welcome, setWelcome] = useState('');
  const [tone, setTone] = useState('Friendly');
  const [business, setBusiness] = useState('');

  useEffect(() => {
    const domain = window.location.hostname.split('.')[0];
    setBusiness(domain);
  }, []);

  const save = async () => {
    await fetch('/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ welcomeMessage: welcome, tone, businessName: business })
    });
    localStorage.setItem('configSet', 'true');
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Store Setup</h2>
        <label>
          Welcome message
          <input value={welcome} onChange={e => setWelcome(e.target.value)} />
        </label>
        <label>
          AI tone
          <select value={tone} onChange={e => setTone(e.target.value)}>
            <option value="Friendly">Friendly</option>
            <option value="Formal">Formal</option>
            <option value="Witty">Witty</option>
          </select>
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
