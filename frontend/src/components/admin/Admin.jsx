import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Shield, Plus, Edit, Trash2, Search } from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmationDialog from '../common/ConfirmationDialog';
import UserForm from './UserForm';
import RolesManager from './RolesManager';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Reusable styled components
const StyledButton = ({ children, onClick, variant = 'primary', ...props }) => {
  const baseClasses = "px-4 py-2 flex items-center justify-center font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-200";
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
  };
  return <button onClick={onClick} className={`${baseClasses} ${variants[variant]}`} {...props}>{children}</button>;
};

function Admin() {
  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const roleMap = useMemo(() => new Map(roles.map(role => [role.id, role.name])), [roles]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Modal and Dialog states
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  
  // State for forms and confirmations
  const [currentUser, setCurrentUser] = useState(null);
  const [confirmationData, setConfirmationData] = useState({ action: () => {}, message: '', confirmationText: '' });
  
  // UI feedback states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearMessages = () => { setError(''); setSuccess(''); };

  const fetchData = useCallback(async (endpoint, setter, entityName) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      setter(response.data);
    } catch (err) {
      setError(`Failed to fetch ${entityName}: ${err.response?.data?.detail || err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchData('users', setUsers, 'users');
    fetchData('roles', setRoles, 'roles');
  }, [fetchData]);

  // Filtered users for the table
  const filteredUsers = useMemo(() => {
    if (!searchQuery) {
      return users;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return users.filter(user =>
      user.username.toLowerCase().includes(lowerCaseQuery) ||
      user.email.toLowerCase().includes(lowerCaseQuery)
    );
  }, [users, searchQuery]);

  // --- User Management Handlers ---
  const handleOpenCreateUserModal = () => {
    setModalMode('create');
    setCurrentUser(null);
    setUserModalOpen(true);
  };

  const handleOpenEditUserModal = (user) => {
    setModalMode('edit');
    setCurrentUser(user);
    setUserModalOpen(true);
  };

  const handleSaveUser = (userData) => {
    const actionText = modalMode === 'create' ? 'create' : 'update';
    setConfirmationData({
      action: () => () => executeSaveUser(userData),
      message: `You are about to ${actionText} a user.`,
      confirmationText: "SAVE",
    });
    setConfirmOpen(true);
  };

  const executeSaveUser = async (userData) => {
    setConfirmOpen(false);
    setUserModalOpen(false);
    clearMessages();
    const token = localStorage.getItem('token');
    const url = modalMode === 'create'
      ? `${API_BASE_URL}/admin/users`
      : `${API_BASE_URL}/admin/users/${currentUser.id}`;
    const method = modalMode === 'create' ? 'post' : 'put';

    try {
      await axios[method](url, userData, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(`User successfully ${modalMode === 'create' ? 'created' : 'updated'}.`);
      fetchData('users', setUsers, 'users');
    } catch (err) {
      setError(`Failed to save user: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleOpenDeleteUserDialog = (user) => {
    setConfirmationData({
      action: () => () => executeDeleteUser(user.id),
      message: `You are about to delete the user "${user.username}". This action cannot be undone.`,
      confirmationText: user.username,
    });
    setConfirmOpen(true);
  };

  const executeDeleteUser = async (userId) => {
    setConfirmOpen(false);
    clearMessages();
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API_BASE_URL}/admin/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('User deleted successfully.');
      fetchData('users', setUsers, 'users');
    } catch (err) {
      setError(`Failed to delete user: ${err.response?.data?.detail || err.message}`);
    }
  };

  // --- Role Management Handlers ---
  const handleCreateRole = (roleName) => {
    setConfirmationData({
      action: () => () => executeCreateRole(roleName),
      message: `You are about to create a new role named "${roleName}".`,
      confirmationText: 'CREATE',
    });
    setConfirmOpen(true);
  };

  const executeCreateRole = async (roleName) => {
    setConfirmOpen(false);
    clearMessages();
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API_BASE_URL}/admin/roles`, { name: roleName }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Role created successfully.');
      fetchData('roles', setRoles, 'roles');
    } catch (err) {
      setError(`Failed to create role: ${err.response?.data?.detail || err.message}`);
    }
  };
  
  const handleUpdateRole = (role) => {
    setConfirmationData({
      action: () => () => executeUpdateRole(role),
      message: `You are about to update a role to have the name "${role.name}".`,
      confirmationText: 'UPDATE',
    });
    setConfirmOpen(true);
  };

  const executeUpdateRole = async (role) => {
    setConfirmOpen(false);
    clearMessages();
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API_BASE_URL}/admin/roles/${role.id}`, { name: role.name }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Role updated successfully.');
      fetchData('roles', setRoles, 'roles');
    } catch (err) {
      setError(`Failed to update role: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeleteRole = (role) => {
    setConfirmationData({
      action: () => () => executeDeleteRole(role.id),
      message: `You are about to delete the role "${role.name}". This may affect users with this role.`,
      confirmationText: role.name,
    });
    setConfirmOpen(true);
  };

  const executeDeleteRole = async (roleId) => {
    setConfirmOpen(false);
    clearMessages();
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API_BASE_URL}/admin/roles/${roleId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Role deleted successfully.');
      fetchData('roles', setRoles, 'roles');
      fetchData('users', setUsers, 'users'); // Refresh users to reflect role changes
    } catch (err) {
      setError(`Failed to delete role: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin - User Management</h1>
        <p className="text-gray-500 mt-1">Create, edit, and manage users and their roles.</p>
      </header>

      <div className="flex space-x-4 mb-8">
        <StyledButton onClick={handleOpenCreateUserModal}><Plus className="mr-2" /> Create New User</StyledButton>
        <StyledButton onClick={() => setRoleModalOpen(true)} variant="secondary"><Shield className="mr-2" /> Manage Roles</StyledButton>
      </div>
      
      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-md" role="alert">{error}</div>}
      {success && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-lg shadow-md" role="alert">{success}</div>}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Existing Users</h3>
          {/* Search Input */}
          <div className="w-1/3 flex items-center">
            <Search className="text-gray-400 mr-2" size={20} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{roleMap.get(user.role_id) || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                    <button onClick={() => handleOpenEditUserModal(user)} className="text-blue-600 hover:text-blue-800 p-1"><Edit size={18} /></button>
                    <button onClick={() => handleOpenDeleteUserDialog(user)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-4 text-gray-500">No users found matching your search.</div>
          )}
        </div>
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} title={modalMode === 'create' ? 'Create New User' : 'Edit User'}>
        <UserForm user={currentUser} roles={roles} onSave={handleSaveUser} onCancel={() => setUserModalOpen(false)} />
      </Modal>

      <Modal isOpen={isRoleModalOpen} onClose={() => setRoleModalOpen(false)} title="Manage Roles">
        <RolesManager roles={roles} onCreate={handleCreateRole} onSave={handleUpdateRole} onDelete={handleDeleteRole} />
      </Modal>

      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmationData.action()}
        title="Are you sure?"
        confirmationText={confirmationData.confirmationText}
      >
        <p>{confirmationData.message}</p>
      </ConfirmationDialog>
    </div>
  );
}

export default Admin;
