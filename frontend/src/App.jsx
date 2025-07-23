import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './Chat';
import Dashboard from './Dashboard';
import Login from './Login';
import Signup from './Signup';
import Navbar from './Navbar';
import RequireAuth from './RequireAuth';
import RedirectIfAuthed from './RedirectIfAuthed';
import Setup from './Setup';

export default function App() {
  return (
    <HashRouter>
      <Navbar />
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
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
        <Route
          path="/setup"
          element={
            <RequireAuth>
              <Setup />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
