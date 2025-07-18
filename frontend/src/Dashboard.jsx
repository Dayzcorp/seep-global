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
    tokensUsed: usage.tokensUsed,
    tokenLimit: usage.tokenLimit,
  };
  const usagePct = Math.min(100, (display.tokensUsed / display.tokenLimit) * 100);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <section>
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <i className="fa-solid fa-chart-column text-indigo-500" /> Usage Analytics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <i className="fa-solid fa-comments text-indigo-500 mb-1"></i>
            <p className="font-bold text-lg">{display.totalChats}</p>
            <p className="text-sm text-gray-500">Total chats</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <i className="fa-solid fa-message text-indigo-500 mb-1"></i>
            <p className="font-bold text-lg">{display.monthlyMessages.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Monthly messages</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <i className="fa-solid fa-chart-line text-indigo-500 mb-1"></i>
            <p className="font-bold text-lg">{display.avgMessages}</p>
            <p className="text-sm text-gray-500">Avg. messages/chat</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <i className="fa-solid fa-user text-indigo-500 mb-1"></i>
            <p className="font-bold text-lg">{display.uniqueVisitors}</p>
            <p className="text-sm text-gray-500">Visitors</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <i className="fa-solid fa-circle-check text-indigo-500 mb-1"></i>
            <p className="font-bold text-lg">{display.successRate}%</p>
            <p className="text-sm text-gray-500">Success rate</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <i className="fa-solid fa-bolt text-indigo-500 mb-1"></i>
            <p className="font-bold text-lg">{display.conversions}</p>
            <p className="text-sm text-gray-500">Conversions</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center flex flex-col items-center">
            <p className="font-bold text-lg">{display.plan}</p>
            <p className="text-sm text-gray-500">Plan</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium mb-1">Token usage</p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="bg-indigo-500 h-3" style={{ width: `${usagePct}%` }} />
          </div>
          <p className="text-xs mt-1 text-gray-500">{display.tokensUsed} / {display.tokenLimit} tokens</p>
        </div>
      </section>

      <section className="faqs">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-question text-indigo-500" /> FAQs
        </h2>
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
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-envelope text-indigo-500" /> Message Templates
        </h2>
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
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-box text-indigo-500" /> Product Insights
        </h2>
        <div className="bestsellers">
          {bestsellers.length === 0 && <p>No data available</p>}
          {bestsellers.map((p, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-3 text-center">
              {p.image && <img src={p.image} alt={p.title} className="mx-auto mb-1 max-w-[100px]" />}
              <p>{p.title}</p>
              <p className="inventory">Inventory: {p.inventory}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="suggestions">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="fa-solid fa-lightbulb text-indigo-500" /> Smart Suggestions
        </h2>
        <div className="grid gap-2 sm:grid-cols-3 suggestions-list">
          {suggestions.map((text, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow p-3 cursor-pointer hover:bg-indigo-50"
              onClick={clickSuggestion}
            >
              {text}
            </div>
          ))}
        </div>
      </section>
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
