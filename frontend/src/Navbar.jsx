import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './styles.css';
import { API_BASE } from './Settings';

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setLoggedIn(true);
        } else {
          setLoggedIn(false);
        }
      } catch (err) {
        console.error('Navbar me error:', err);
        setLoggedIn(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const load = async () => {
      try {
        const [sRes, uRes] = await Promise.all([
          fetch(`${API_BASE}/merchant/subscription`, { credentials: 'include' }),
          fetch(`${API_BASE}/merchant/usage`, { credentials: 'include' })
        ]);
        const sub = await sRes.json();
        const usage = await uRes.json();
        setProfile(p => ({ ...p, subscription: sub, tokens: usage.tokens }));
      } catch (err) {
        console.error('Subscription fetch error:', err);
      }
    };
    load();
  }, [loggedIn]);

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setLoggedIn(false);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-links">
        {loggedIn ? (
          <>
            <NavLink
              to="/chat"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Chat Assistant
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Dashboard
            </NavLink>
            <div className="nav-link" style={{ position: 'relative' }}>
              <span onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>Profile ▾</span>
              {open && profile && (
                <div className="profile-drop">
                  <p className="email">{profile.email}</p>
                  {profile.subscription && (
                    <p className="plan">
                      {profile.subscription.plan} – renews {profile.subscription.nextBillDate}
                    </p>
                  )}
                  {profile.tokens !== undefined && (
                    <p className="tokens">Tokens Used: {profile.tokens}</p>
                  )}
                  <button onClick={logout}>Logout</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Login
            </NavLink>
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Sign Up
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
