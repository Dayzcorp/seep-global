import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [merchantId, setMerchantId] = useState('demo');
  const [usage, setUsage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [uRes, lRes, sRes] = await Promise.all([
        fetch(`/merchant/${merchantId}/usage`),
        fetch(`/merchant/${merchantId}/logs`),
        fetch(`/merchant/${merchantId}/suggestions`)
      ]);

      if (!uRes.ok || !lRes.ok || !sRes.ok) {
        throw new Error('Request failed');
      }

      const usageData = await uRes.json();
      const logsData = await lRes.json();
      const tipsData = await sRes.json();

      setUsage(usageData);
      setLogs((logsData.logs || []).slice().reverse());
      setTips(tipsData.tips || []);
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
        <Link to="/">
          <button className="bg-indigo-600 text-white px-3 py-1 rounded">Back to Chat</button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <input
          className="border p-2 flex-1 min-w-[150px]"
          value={merchantId}
          onChange={e => setMerchantId(e.target.value)}
          placeholder="Merchant ID"
        />
        <button
          onClick={fetchData}
          className="bg-indigo-500 text-white px-4 py-2 rounded"
        >
          Fetch Data
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

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
        </section>
      )}

      {logs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Chat Logs</h2>
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="bg-white rounded shadow p-3">
                <p className="text-sm text-gray-500 mb-1">{new Date(log.timestamp).toLocaleString()}</p>
                <p><strong>User:</strong> {log.user}</p>
                <p><strong>Assistant:</strong> {log.assistant}</p>
              </div>
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
    </div>
  );
}
