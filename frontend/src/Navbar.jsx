import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './styles.css';

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/me`, { credentials: 'include' })
      .then(res => setLoggedIn(res.ok))
      .catch(() => setLoggedIn(false));
  }, []);

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
            <span onClick={logout} className="nav-link" style={{ cursor: 'pointer' }}>
              Logout
            </span>
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
