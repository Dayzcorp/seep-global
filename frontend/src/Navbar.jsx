import React from 'react';
import { NavLink } from 'react-router-dom';
import './styles.css';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-links">
        <NavLink
          end
          to="/"
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
        <NavLink
          to="/login"
          className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
        >
          Login
        </NavLink>
      </div>
    </nav>
  );
}
