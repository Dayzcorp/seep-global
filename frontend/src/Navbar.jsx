import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './styles.css';

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/me`, { credentials: 'include' })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setLoggedIn(true);
        } else {
          setLoggedIn(false);
        }
      })
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    fetch(`${import.meta.env.VITE_API_BASE}/merchant/subscription`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setProfile(p => ({ ...p, subscription: data })))
      .catch(() => {});
  }, [loggedIn]);

  const logout = async () => {
    await fetch(`${import.meta.env.VITE_API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    setLoggedIn(false);
    window.location.href = '/';
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
