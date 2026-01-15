import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, Users, Database } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function Dashboard({ user }) {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserInfo(response.data);
      } catch (err) {
        console.error('Failed to fetch user info:', err);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: User Info */}
        <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-lg p-6 shadow-lg">
          <Users size={32} className="text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800">User Profile</h3>
          <p className="text-gray-600">Role: {userInfo?.role || 'Loading...'}</p>
        </div>

        {/* Card 2: Vectors Overview */}
        <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-lg p-6 shadow-lg">
          <Database size={32} className="text-green-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800">Vectors</h3>
          <p className="text-gray-600">Manage your vector data here.</p>
        </div>

        {/* Card 3: Analytics */}
        <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-lg p-6 shadow-lg">
          <BarChart3 size={32} className="text-purple-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800">Analytics</h3>
          <p className="text-gray-600">View insights and reports.</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
