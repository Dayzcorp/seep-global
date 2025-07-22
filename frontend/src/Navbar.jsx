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

  return (
    <nav className="navbar">
      <div className="nav-links">
        {loggedIn && (
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
              Merchant Dashboard
            </NavLink>
          </>
        )}
        {!loggedIn && (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              isActive ? 'nav-link active' : 'nav-link'
            }
          >
            Login
          </NavLink>
        )}
      </div>
    </nav>
  );
}
