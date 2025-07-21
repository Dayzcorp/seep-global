import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = 'http://localhost:5000';

export default function Dashboard() {
  const [merchantId, setMerchantId] = useState('');
  const [usage, setUsage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [uRes, lRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/merchant/usage`),
        fetch(`${API_BASE}/merchant/logs`),
        fetch(`${API_BASE}/merchant/suggestions`)
      ]);

      if (!uRes.ok || !lRes.ok || !sRes.ok) {
        throw new Error('Request failed');
      }

      const toJson = async (res) => {
        const text = await res.text();
        if (!res.headers.get('content-type')?.includes('application/json')) {
          console.warn('Expected JSON but received:', text.slice(0, 100));
          return null;
        }
        return JSON.parse(text);
      };

      const usageData = await toJson(uRes);
      const logsData = await toJson(lRes);
      const tipsData = await toJson(sRes);

      setUsage(usageData);
      setLogs((logsData.logs || []).slice().reverse());
      setTips(tipsData.tips || []);
    } catch (err) {
      setError('Failed to fetch data');
      setAlert('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(''), 3000);
      return () => clearTimeout(t);
    }
  }, [alert]);

  const logsByDate = useMemo(() => {
    const groups = {};
    logs.forEach(l => {
      const d = l.timestamp.slice(0, 10);
      (groups[d] = groups[d] || []).push(l);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [logs]);

  const tokenHistory = useMemo(() => {
    const days = {};
    logs.forEach(l => {
      const d = l.timestamp.slice(0, 10);
      const tokens = (l.user.split(/\s+/).length + l.assistant.split(/\s+/).length);
      days[d] = (days[d] || 0) + tokens;
    });
    return Object.entries(days).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [logs]);

  const exportLogs = () => {
    if (!logs.length) return;
    const rows = [
      ['timestamp', 'user', 'assistant'],
      ...logs.map(l => [l.timestamp, l.user, l.assistant])
    ];
    const csv = rows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${merchantId || 'merchant'}_logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const botOnline = logs.length && (Date.now() - new Date(logs[0].timestamp)) < 5 * 60 * 1000;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Merchant Dashboard
          <span className={`px-2 py-1 rounded text-xs text-white ${botOnline ? 'bg-green-500' : 'bg-red-500'}`}>{botOnline ? 'Online' : 'Offline'}</span>
        </h1>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <button
          onClick={fetchData}
          className="bg-indigo-500 text-white px-4 py-2 rounded"
        >
          Refresh
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !usage && logs.length === 0 && !error && (
        <p className="text-gray-500">No data found for this merchant.</p>
      )}

      {usage && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Usage</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow text-center">
              <p className="text-lg font-bold">{usage.requests}</p>
              <p className="text-sm text-gray-500">Requests</p>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <p className="text-lg font-bold">{usage.tokens}</p>
              <p className="text-sm text-gray-500">Tokens Used</p>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <p className="text-lg font-bold">{usage.avgTokens.toFixed ? usage.avgTokens.toFixed(1) : usage.avgTokens}</p>
              <p className="text-sm text-gray-500">Avg Tokens/Chat</p>
            </div>
          </div>
          {tokenHistory.length > 0 && (
            <div className="mt-4">
              <div className="chart">
                {tokenHistory.map(([d, t]) => {
                  const max = Math.max(...tokenHistory.map(([, v]) => v));
                  return (
                    <div key={d} className="chart-bar" style={{ height: `${(t / max) * 100}%` }} title={`${d}: ${t} tokens`} />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {tokenHistory.map(([d]) => (
                  <span key={d}>{new Date(d).getDate()}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {logs.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Chat Logs</h2>
            <button onClick={exportLogs} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded">Export Logs</button>
          </div>
          <div className="space-y-2">
            {logsByDate.map(([date, items]) => (
              <details key={date} className="bg-white rounded shadow p-3">
                <summary className="cursor-pointer font-medium">
                  {new Date(date).toLocaleDateString()} ({items.length})
                </summary>
                <div className="space-y-2 mt-2">
                  {items.map((log, i) => (
                    <div key={i} className="border-t pt-2 first:border-t-0">
                      <p className="text-sm text-gray-500 mb-1">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      <p><strong>User:</strong> {log.user}</p>
                      <p><strong>Assistant:</strong> {log.assistant}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {tips.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">AI Suggestions</h2>
          <ul className="list-disc pl-5 space-y-1">
            {tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}
      {alert && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow">
          {alert}
        </div>
      )}
    </div>
  );
}
