import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function Admin() {
  const [roleName, setRoleName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const createRole = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/roles`, { name: roleName }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(`Role created: ${response.data.name}`);
      setRoleName('');
    } catch (err) {
      setError('Failed to create role: ' + (err.response?.data?.detail || err.message));
    }
  };

  const createUser = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/users`, { username, email, password, role_id: parseInt(roleId) }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(`User created: ${response.data.username}`);
      setUsername(''); setEmail(''); setPassword(''); setRoleId('');
    } catch (err) {
      setError('Failed to create user: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <h2>Admin Panel</h2>
      <div>
        <h3>Create Role</h3>
        <input placeholder="Role Name" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
        <button onClick={createRole}>Create Role</button>
      </div>
      <div>
        <h3>Create User</h3>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input placeholder="Role ID (e.g., 1 for admin, 2 for user)" value={roleId} onChange={(e) => setRoleId(e.target.value)} />
        <button onClick={createUser}>Create User</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
    </div>
  );
}

export default Admin;
