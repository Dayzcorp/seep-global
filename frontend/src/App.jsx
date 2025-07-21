import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './Chat';
import Dashboard from './Dashboard';
import Navbar from './Navbar';

// For easier debugging, install React DevTools: https://reactjs.org/link/react-devtools
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
