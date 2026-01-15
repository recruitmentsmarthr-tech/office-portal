import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function Dashboard({ user }) {
  const [userInfo, setUserInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      console.log('Fetching user info for dashboard');
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('User info fetched successfully:', response.data);
        setUserInfo(response.data);
      } catch (err) {
        console.error('Failed to fetch user info:', err);
      }
    };
    fetchUser();
  }, []);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const dashboardStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    minHeight: 'calc(100vh - 60px)',
  };

  const cardStyle = {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e9ecef',
  };

  const hamburgerStyle = {
    display: window.innerWidth <= 768 ? 'block' : 'none',
    fontSize: '24px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#007bff',
  };

  const sidebarStyle = {
    position: 'fixed',
    top: '60px',
    left: menuOpen ? '0' : '-250px',
    width: '250px',
    height: 'calc(100vh - 60px)',
    backgroundColor: '#ffffff',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
    transition: 'left 0.3s ease',
    padding: '20px',
    zIndex: 1000,
  };

  const overlayStyle = {
    display: menuOpen ? 'block' : 'none',
    position: 'fixed',
    top: '60px',
    left: '0',
    width: '100%',
    height: 'calc(100vh - 60px)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  };

  return (
    <div style={{ position: 'relative' }}>
      <button style={hamburgerStyle} onClick={toggleMenu}>☰</button>
      <div style={overlayStyle} onClick={toggleMenu}></div>
      <div style={sidebarStyle}>
        <h3>Menu</h3>
        <Link to="/vectors" onClick={toggleMenu}>Manage Vectors</Link>
        {userInfo && userInfo.role === 'admin' && <Link to="/admin" onClick={toggleMenu}>Admin Panel</Link>}
      </div>
      <div style={dashboardStyle}>
        <div style={cardStyle}>
          <h2>Welcome to Dashboard</h2>
          {userInfo && <p>Role: {userInfo.role}</p>}
        </div>
        <div style={cardStyle}>
          <h3>Quick Links</h3>
          <Link to="/vectors">Manage Vectors</Link>
          {userInfo && userInfo.role === 'admin' && <Link to="/admin">Admin Panel</Link>}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
