import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './Chat';
import Dashboard from './Dashboard';
import Login from './Login';
import Signup from './Signup';
import Navbar from './Navbar';
import RequireAuth from './RequireAuth';

// For easier debugging, install React DevTools: https://reactjs.org/link/react-devtools
export default function App() {
  return (
    <HashRouter>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
