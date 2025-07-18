import React, { useEffect, useState } from 'react';
import SetupModal from './SetupModal';

export default function Dashboard() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);
  const [showSetup, setShowSetup] = useState(!localStorage.getItem('configSet'));

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

  const clickSuggestion = async () => {
    await fetch('/conversion', { method: 'POST' });
  };

  if (error) {
    return <div className="dashboard">{error}</div>;
  }

  if (!usage) {
    return <div className="dashboard">Loading...</div>;
  }

  const display = {
    totalChats: usage.totalChats,
    monthlyMessages: usage.monthlyMessages,
    avgMessages: usage.avgMessages.toFixed ? usage.avgMessages.toFixed(2) : usage.avgMessages,
    plan: usage.plan,
    uniqueVisitors: usage.uniqueVisitors,
    successRate: (usage.successRate * 100).toFixed(1),
    conversions: usage.conversions,
  };

  return (
    <div className="dashboard">
      <section className="analytics">
        <h2 className="section-title">Usage Analytics</h2>
        <div className="stats-grid">
          <div className="card">
            <i className="fa-solid fa-comments"></i>
            <p className="stat-num">{display.totalChats}</p>
            <p className="stat-label">Total chats</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-message"></i>
            <p className="stat-num">{display.monthlyMessages.toLocaleString()}</p>
            <p className="stat-label">Monthly messages</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-chart-line"></i>
            <p className="stat-num">{display.avgMessages}</p>
            <p className="stat-label">Avg. messages/chat</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-user"></i>
            <p className="stat-num">{display.uniqueVisitors}</p>
            <p className="stat-label">Visitors</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-circle-check"></i>
            <p className="stat-num">{display.successRate}%</p>
            <p className="stat-label">Success rate</p>
          </div>
          <div className="card">
            <i className="fa-solid fa-bolt"></i>
            <p className="stat-num">{display.conversions}</p>
            <p className="stat-label">Conversions</p>
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
            <div key={i} className="card suggestion-card" onClick={clickSuggestion}>
              {text}
            </div>
          ))}
        </div>
      </section>
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
