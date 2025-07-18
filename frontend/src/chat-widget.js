import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

export default function mountChatWidget(options = {}) {
  const targetId = options.targetId || 'seep-chat-widget';
  let container = document.getElementById(targetId);
  if (!container) {
    container = document.createElement('div');
    container.id = targetId;
    document.body.appendChild(container);
  }
  ReactDOM.createRoot(container).render(<App />);
}
