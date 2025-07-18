import React, { useEffect, useState } from 'react';
import SetupModal from './SetupModal';

export default function Dashboard() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);
  const [showSetup, setShowSetup] = useState(!localStorage.getItem('configSet'));
  const [templates, setTemplates] = useState({ welcome: '', abandoned_cart: '', faq: '' });
  const [bestsellers, setBestsellers] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });

  useEffect(() => {
    fetch('/usage')
      .then(res => res.json())
      .then(data => setUsage(data))
      .catch(() => setError('Failed to load usage'));
    fetch('/templates')
      .then(res => res.json())
      .then(data => setTemplates(data));
    fetch('/bestsellers')
      .then(res => res.json())
      .then(data => setBestsellers(data.products || []));
    fetch('/faq').then(res => res.json()).then(data => setFaqs(data));
  }, []);

  const suggestions = [
    'Add a product FAQ to reduce support questions',
    'Enable abandoned cart messages',
    'Set up a welcome greeting for new visitors',
  ];

  const clickSuggestion = async () => {
    await fetch('/conversion', { method: 'POST' });
  };

  const saveTemplates = async () => {
    const payload = {
      welcome: templates.welcome,
      abandonedCart: templates.abandoned_cart,
      faq: templates.faq,
    };
    await fetch('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const addFaq = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    await fetch('/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFaq),
    });
    setFaqs(f => [...f, newFaq]);
    setNewFaq({ question: '', answer: '' });
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

      <section className="faqs">
        <h2 className="section-title">FAQs</h2>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <p><strong>Q:</strong> {f.question}</p>
              <p><strong>A:</strong> {f.answer}</p>
            </div>
          ))}
        </div>
        <div className="faq-add">
          <input
            placeholder="Question"
            value={newFaq.question}
            onChange={e => setNewFaq(n => ({ ...n, question: e.target.value }))}
          />
          <textarea
            placeholder="Answer"
            value={newFaq.answer}
            onChange={e => setNewFaq(n => ({ ...n, answer: e.target.value }))}
          />
          <button onClick={addFaq}>Add FAQ</button>
        </div>
      </section>

      <section className="templates">
        <h2 className="section-title">Message Templates</h2>
        <div className="template-item">
          <label>
            Welcome greeting
            <textarea value={templates.welcome} onChange={e => setTemplates(t => ({ ...t, welcome: e.target.value }))} />
          </label>
          <p className="preview">Preview: {templates.welcome}</p>
          <button onClick={saveTemplates}>Save</button>
        </div>
        <div className="template-item">
          <label>
            Abandoned cart follow-up
            <textarea value={templates.abandoned_cart} onChange={e => setTemplates(t => ({ ...t, abandoned_cart: e.target.value }))} />
          </label>
          <p className="preview">Preview: {templates.abandoned_cart}</p>
          <button onClick={saveTemplates}>Save</button>
        </div>
        <div className="template-item">
          <label>
            FAQ autoresponder
            <textarea value={templates.faq} onChange={e => setTemplates(t => ({ ...t, faq: e.target.value }))} />
          </label>
          <p className="preview">Preview: {templates.faq}</p>
          <button onClick={saveTemplates}>Save</button>
        </div>
      </section>

      <section className="insights">
        <h2 className="section-title">Product Insights</h2>
        <div className="bestsellers">
          {bestsellers.length === 0 && <p>No data available</p>}
          {bestsellers.map((p, i) => (
            <div key={i} className="card bestseller-card">
              {p.image && <img src={p.image} alt={p.title} />}
              <p>{p.title}</p>
              <p className="inventory">Inventory: {p.inventory}</p>
            </div>
          ))}
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
