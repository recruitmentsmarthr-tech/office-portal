import React, { useState, useEffect } from 'react';

const StyledInput = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <input
      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  </div>
);

function UserForm({ user, roles, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role_id: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: '', // Password is not pre-filled for security
        role_id: user.role_id,
      });
    } else {
      setFormData({ username: '', email: '', password: '', role_id: '' });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <StyledInput
        label="Username"
        name="username"
        value={formData.username}
        onChange={handleChange}
        required
      />
      <StyledInput
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        required
      />
      <StyledInput
        label={user ? "New Password (optional)" : "Password"}
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        required={!user}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700">Role</label>
        <select
          name="role_id"
          value={formData.role_id}
          onChange={handleChange}
          required
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>Select a role</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end space-x-4 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Save User
        </button>
      </div>
    </form>
  );
}

export default UserForm;
