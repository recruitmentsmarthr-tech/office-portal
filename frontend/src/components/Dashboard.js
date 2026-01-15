import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function Dashboard({ user }) {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserInfo(response.data);
    };
    fetchUser();
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      {userInfo && <p>Role: {userInfo.role}</p>}
      <Link to="/vectors">Manage Vectors</Link>
      {userInfo && userInfo.role === 'admin' && <Link to="/admin">Admin Panel</Link>}
    </div>
  );
}

export default Dashboard;
