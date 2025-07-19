import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatApp from './ChatApp';
import Dashboard from './Dashboard';
import Navbar from './Navbar';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
