import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from './Settings';

export default function Dashboard() {
  const [merchantId, setMerchantId] = useState(null);
  const [me, setMe] = useState(null);
  const [usage, setUsage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tips, setTips] = useState([]);
  const [productInfo, setProductInfo] = useState(null);
  const [productSettings, setProductSettings] = useState(null);
  const [botSettings, setBotSettings] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const fetchMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setMe(data);
      setMerchantId(data.id);
      setBotSettings({ greeting: data.greeting, color: data.color, suggestProducts: data.suggestProducts });
      setProductSettings({
        storeType: data.storeType,
        storeDomain: data.storeDomain,
        apiKey: data.apiKey,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    if (!merchantId) return;
    setLoading(true);
    setError('');
    try {
      const [uRes, lRes, sRes, pRes, psRes, bsRes] = await Promise.all([
        fetch(`${API_BASE}/merchant/usage`),
        fetch(`${API_BASE}/merchant/logs`),
        fetch(`${API_BASE}/merchant/suggestions`),
        fetch(`${API_BASE}/merchant/${merchantId}/products`),
        fetch(`${API_BASE}/merchant/product-settings/${merchantId}`),
        fetch(`${API_BASE}/merchant/bot-settings`)
      ]);

      if (!uRes.ok || !lRes.ok || !sRes.ok) {
        throw new Error('Request failed');
      }

      const toJson = async (res) => {
        const text = await res.text();
        if (!res.headers.get('content-type')?.includes('application/json')) {
          return null;
        }
        return JSON.parse(text);
      };

      const usageData = await toJson(uRes);
      const logsData = await toJson(lRes);
      const tipsData = await toJson(sRes);
      const productData = await toJson(pRes);
      const productSettingsData = await toJson(psRes);
      const botSettingsData = await toJson(bsRes);

      setUsage(usageData);
      setLogs((logsData.logs || []).slice().reverse());
      setTips(tipsData.tips || []);
      setProductInfo(productData);
      setProductSettings(productSettingsData);
      setBotSettings(botSettingsData);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to fetch data');
      setAlert('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    fetchData();
  }, [merchantId]);

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


  const fetchProductList = async () => {
    try {
      const res = await fetch(`${API_BASE}/merchant/${merchantId}/products`);
      const text = await res.text();
      if (res.headers.get('content-type')?.includes('application/json')) {
        setProductInfo(JSON.parse(text));
      }
    } catch (err) {
      console.error('Fetch products error:', err);
      setSyncError('Failed to fetch products');
    }
  };

  const syncProducts = async () => {
    setSyncError('');
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/products/${merchantId}`, { method: 'POST' });
      if (!res.ok) throw new Error('sync');
      await fetchProductList();
    } catch (err) {
      console.error('Sync products error:', err);
      setSyncError('Failed to sync products');
    } finally {
      setSyncing(false);
    }
  };

  const saveProductSettings = async () => {
    try {
      await fetch(`${API_BASE}/merchant/product-settings/${merchantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productSettings)
      });
      fetchData();
      setAlert('Settings saved');
    } catch (err) {
      console.error('Save product settings error:', err);
      setAlert('Failed to save settings');
    }
  };

  const saveBotSettings = async () => {
    try {
      await fetch(`${API_BASE}/merchant/bot-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botSettings)
      });
      fetchData();
      setAlert('Settings saved');
    } catch (err) {
      console.error('Save bot settings error:', err);
      setAlert('Failed to save settings');
    }
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

      <div className="flex gap-4 mb-4">
        <button className={tab === 'overview' ? 'font-bold' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'products' ? 'font-bold' : ''} onClick={() => setTab('products')}>Product Awareness</button>
        <button className={tab === 'customize' ? 'font-bold' : ''} onClick={() => setTab('customize')}>Customize Bot</button>
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
        <div className="bg-white p-6 rounded shadow text-center">
          <h2 className="text-lg font-semibold mb-2">Welcome to your dashboard</h2>
          <p className="text-gray-500">Get started by chatting with Seep or embedding the widget on your store.</p>
        </div>
      )}

      {tab === 'overview' && usage && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Usage</h2>
          {me && <p className="mb-2 text-sm text-gray-700">Current Plan: {me.plan}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow text-center">
              <p className="text-lg font-bold">{usage.requests}</p>
              <p className="text-sm text-gray-500">Requests</p>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <p className="text-lg font-bold">{usage.tokens}</p>
              <p className="text-sm text-gray-500">Tokens Used</p>
            </div>
            {usage.limit !== null && (
              <div className="bg-white p-4 rounded shadow text-center">
                <p className="text-lg font-bold">{usage.tokens}/{usage.limit}</p>
                <p className="text-sm text-gray-500">Token Usage</p>
              </div>
            )}
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

      {tab === 'products' && productInfo && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Product Awareness</h2>
          <p>Sync Status: {productInfo.syncStatus || 'unknown'}</p>
          <p>Last Updated: {productInfo.lastUpdated ? new Date(productInfo.lastUpdated).toLocaleString() : 'never'}</p>
          <div className="space-y-2 mt-2">
            <label className="block">
              Store Type
              <select className="ml-2" value={productSettings?.storeType || 'Custom'} onChange={e => setProductSettings(ps => ({...ps, storeType: e.target.value}))}>
                <option value="Shopify">Shopify</option>
                <option value="WooCommerce">WooCommerce</option>
                <option value="Custom">Custom</option>
              </select>
            </label>
            <label className="block">
              Store Domain
              <input className="border ml-2" value={productSettings?.storeDomain || ''} onChange={e => setProductSettings(ps => ({...ps, storeDomain: e.target.value}))} />
            </label>
            <label className="block">
              API Key/Token
              <input className="border ml-2" value={productSettings?.apiKey || ''} onChange={e => setProductSettings(ps => ({...ps, apiKey: e.target.value}))} />
            </label>
            <button onClick={saveProductSettings} className="bg-indigo-500 text-white px-4 py-1 rounded">Save Settings</button>
            <button onClick={syncProducts} className="ml-2 bg-indigo-500 text-white px-4 py-1 rounded">Sync Products</button>
            <p className="text-sm">Products cached: {productInfo.products.length}</p>
          </div>
        </section>
      )}

      {tab === 'customize' && botSettings && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Customize Bot</h2>
          <div className="space-y-2 mt-2">
            <label className="block">
              Welcome Greeting
              <input className="border ml-2" value={botSettings.greeting || ''} onChange={e => setBotSettings(bs => ({...bs, greeting: e.target.value}))} />
            </label>
            <label className="block">
              Primary Color
              <input type="color" className="ml-2" value={botSettings.color || '#3b82f6'} onChange={e => setBotSettings(bs => ({...bs, color: e.target.value}))} />
            </label>
            <label className="block">
              <input type="checkbox" className="mr-1" checked={botSettings.suggestProducts} onChange={e => setBotSettings(bs => ({...bs, suggestProducts: e.target.checked}))} />
              Enable Product Suggestions
            </label>
            <button onClick={saveBotSettings} className="bg-indigo-500 text-white px-4 py-1 rounded">Save Settings</button>
          </div>
        </section>
      )}

      {tab === 'overview' && logs.length > 0 && (
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

      {productInfo && (
        <section>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Synced Products</h2>
            <button onClick={syncProducts} className="bg-indigo-500 text-white px-3 py-1 rounded">
              {syncing ? 'Syncing...' : 'Sync Products'}
            </button>
          </div>
          {syncError && <p className="text-red-500 mb-2">{syncError}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {productInfo.products.map((p, i) => (
              <div key={i} className="bg-white rounded shadow p-2 flex flex-col">
                {p.image && <img src={p.image} alt={p.title} className="h-24 w-full object-cover mb-2" />}
                <h3 className="font-medium text-sm truncate">{p.title}</h3>
                <p className="text-sm text-gray-500">{p.price}</p>
                {p.description && <p className="text-sm flex-grow">{p.description.slice(0,150)}{p.description.length>150?'...':''}</p>}
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 text-center bg-indigo-500 text-white text-xs px-2 py-1 rounded">View</a>
              </div>
            ))}
          </div>
        </section>
      )}
      {alert && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow">
          {alert}
        </div>
      )}
      <footer className="text-center text-xs text-gray-400 mt-8">
        <a href="https://docs.seep.ai" target="_blank" rel="noopener noreferrer">SEEP Documentation</a>
      </footer>
    </div>
  );
}
