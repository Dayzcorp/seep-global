import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [usage, setUsage] = useState({});

  useEffect(() => {
    fetch('/usage')
      .then(res => res.json())
      .then(data => setUsage(data))
      .catch(err => console.error('Failed to load usage:', err));
  }, []);

  return (
    <div className="dashboard">
      <h2>Usage Stats</h2>
      <ul>
        {Object.entries(usage).map(([session, stats]) => (
          <li key={session}>
            <strong>{session}</strong>: {stats.requests} requests, {stats.tokens} tokens
          </li>
        ))}
      </ul>
    </div>
  );
}
