import React, { useState, useRef, useEffect } from 'react';
import Settings, { API_BASE } from './Settings';

function Message({ sender, text, time }) {
  return (
    <div className={sender === 'user' ? 'msg user' : 'msg bot'}>
      <div>{text}</div>
      <span className="time">{time}</span>
    </div>
  );
}

export default function ChatApp() {
  const botName = 'Seep';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const loadWelcome = async () => {
      try {
        const res = await fetch(`${API_BASE}/bot/${botName}`, { credentials: 'include' });
        const data = await res.json();
        if (data.suggestion) {
          setMessages([{ sender: 'bot', text: data.suggestion, time: new Date().toLocaleTimeString() }]);
        } else if (data.welcomeMessage) {
          setMessages([{ sender: 'bot', text: data.welcomeMessage, time: new Date().toLocaleTimeString() }]);
        }
      } catch (err) {
        console.error('Load welcome error:', err);
      }
    };
    loadWelcome();
  }, [botName]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input, time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const botPlaceholder = { sender: 'bot', text: '', time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, botPlaceholder]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMsg.text }),
      });
      if (!response.ok) {
        const err = await response.json();
        setMessages(prev => [...prev.slice(0, -1), { sender: 'bot', text: err.message || err.error, time: new Date().toLocaleTimeString() }]);
        setLoading(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        botText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { sender: 'bot', text: botText, time: botPlaceholder.time };
          return copy;
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev.slice(0, -1), { sender: 'bot', text: 'Bot is unavailable. Check server/API key.', time: botPlaceholder.time }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="container">
      <header>
        <h1>{botName} Assistant</h1>
        <button onClick={() => setShowSettings(true)}>Settings</button>
      </header>
      <div className="chat">
        {messages.map((m, i) => <Message key={i} {...m} />)}
        {loading && <div className="typing">{botName} is typing...</div>}
        <div ref={bottomRef} />
      </div>
      <div className="input">
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} />
        <button onClick={sendMessage} disabled={loading}>Send</button>
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
