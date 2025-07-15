import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [usage, setUsage] = useState({ requests: 0, tokens: 0 });
  const botName = sessionStorage.getItem('botName') || 'SEEP';

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/usage');
        if (!res.ok) throw new Error('Failed to fetch usage');
        const data = await res.json();
        const firstKey = Object.keys(data)[0];
        if (firstKey && data[firstKey]) {
          setUsage(data[firstKey]);
        }
      } catch (err) {
        console.error('Error loading usage', err);
      }
    }

    fetchUsage();
  }, []);

  const tier = usage.tokens <= 2000 ? 'Free Tier' : 'Expired / Upgrade needed';

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p>Assistant: {botName}</p>
      <p>Requests: {usage.requests}</p>
      <p>Tokens: {usage.tokens}</p>
      <p>Plan Tier: {tier}</p>
    </div>
  );
}
