import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/usage')
      .then(res => res.json())
      .then(data => setUsage(data))
      .catch(() => setError('Failed to load usage'));
  }, []);

  const suggestions = [
    'Add a product FAQ to reduce support questions',
    'Enable abandoned cart messages',
    'Set up a welcome greeting for new visitors',
  ];

  if (error) {
    return <div className="dashboard">{error}</div>;
  }

  if (!usage) {
    return <div className="dashboard">Loading...</div>;
  }

  const usageValues = Object.values(usage);
  const totalChats = usageValues.reduce((sum, u) => sum + u.requests, 0);
  const monthlyMessages = usageValues.reduce((sum, u) => sum + u.tokens, 0);
  const avgMessages = (monthlyMessages / Math.max(totalChats, 1)).toFixed(2);
  const display = { totalChats, monthlyMessages, avgMessages, plan: 'Free Tier' };

  return (
    <div className="dashboard">
      <section className="analytics">
        <h2 className="section-title">Usage Analytics</h2>
        <div className="stats-grid">
          <div className="card">
            <p className="stat-num">{display.totalChats}</p>
            <p className="stat-label">Total chats</p>
          </div>
          <div className="card">
            <p className="stat-num">{display.monthlyMessages.toLocaleString()}</p>
            <p className="stat-label">Monthly messages</p>
          </div>
          <div className="card">
            <p className="stat-num">{display.avgMessages}</p>
            <p className="stat-label">Avg. messages/chat</p>
          </div>
          <div className="card">
            <p className="stat-num">{display.plan}</p>
            <p className="stat-label">Plan</p>
          </div>
        </div>
      </section>

      <section className="suggestions">
        <h2 className="section-title">Smart Suggestions</h2>
        <div className="suggestions-list">
          {suggestions.map((text, i) => (
            <div key={i} className="card suggestion-card">
              {text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
