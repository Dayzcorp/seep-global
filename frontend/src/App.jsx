import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatApp from './ChatApp';
import Dashboard from './Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
