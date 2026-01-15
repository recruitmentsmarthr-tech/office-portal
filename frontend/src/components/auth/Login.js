import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/token`, new URLSearchParams({
        username,
        password,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      onLogin(response.data.access_token);
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: "'Roboto', sans-serif",
    padding: isMobile ? '10px' : '20px',
  };

  const cardStyle = {
    backgroundColor: '#ffffff',
    padding: isMobile ? '30px 20px' : '50px 40px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: isMobile ? '90%' : '450px',
    textAlign: 'center',
    border: '1px solid #e9ecef',
  };

  const titleStyle = {
    marginBottom: '25px',
    color: '#333',
    fontSize: isMobile ? '28px' : '32px',
    fontWeight: '700',
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  };

  const inputStyle = {
    padding: isMobile ? '14px' : '16px',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '18px',
    outline: 'none',
    transition: 'all 0.3s ease',
    backgroundColor: '#f8f9fa',
  };

  const buttonStyle = {
    padding: isMobile ? '14px' : '16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '18px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
  };

  const errorStyle = {
    color: '#dc3545',
    marginTop: '15px',
    fontSize: isMobile ? '14px' : '16px',
    fontWeight: '500',
  };

  const linkStyle = {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: isMobile ? '14px' : '16px',
    marginTop: '20px',
    display: 'inline-block',
    fontWeight: '500',
    transition: 'color 0.3s ease',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>Welcome Back</h2>
        <form onSubmit={handleSubmit} style={formStyle}>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#007bff')}
            onBlur={(e) => (e.target.style.borderColor = '#e9ecef')}
          />
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#007bff')}
            onBlur={(e) => (e.target.style.borderColor = '#e9ecef')}
          />
          <button
            type="submit"
            style={buttonStyle}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
          >
            Sign In
          </button>
        </form>
        {error && <p style={errorStyle}>{error}</p>}
        <Link
          to="/register"
          style={linkStyle}
          onMouseOver={(e) => (e.target.style.color = '#0056b3')}
          onMouseOut={(e) => (e.target.style.color = '#007bff')}
        >
          New here? Create an account
        </Link>
      </div>
    </div>
  );
}

export default Login;
