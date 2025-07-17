import React from 'react';

export default function Dashboard() {
  const usage = {
    totalChats: 284,
    monthlyMessages: 3201,
    avgMessages: 11.27,
    plan: 'Free Tier',
  };

  const suggestions = [
    'Add a product FAQ to reduce support questions',
    'Enable abandoned cart messages',
    'Set up a welcome greeting for new visitors',
  ];

  return (
    <div className="dashboard">
      <section className="analytics">
        <h2 className="section-title">Usage Analytics</h2>
        <div className="stats-grid">
          <div className="card">
            <p className="stat-num">{usage.totalChats}</p>
            <p className="stat-label">Total chats</p>
          </div>
          <div className="card">
            <p className="stat-num">{usage.monthlyMessages.toLocaleString()}</p>
            <p className="stat-label">Monthly messages</p>
          </div>
          <div className="card">
            <p className="stat-num">{usage.avgMessages}</p>
            <p className="stat-label">Avg. messages/chat</p>
          </div>
          <div className="card">
            <p className="stat-num">{usage.plan}</p>
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
