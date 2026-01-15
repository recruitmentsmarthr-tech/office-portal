import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Layout from './components/Layout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import Vectors from './components/vectors/Vectors';
import Admin from './components/admin/Admin';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem('token');
        } else {
          setUser(decoded);
        }
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode(token);
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <BrowserRouter>
      <div className="App">
        {user ? (
          <Layout user={user} onLogout={logout}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/vectors" element={<Vectors user={user} />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Layout>
        ) : (
          <Routes>
            <Route path="/login" element={<Login onLogin={login} />} />
            <Route path="/register" element={<Register onLogin={login} />} />
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
