import React, { useState } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';

function RolesManager({ roles, onSave, onDelete, onCreate }) {
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState(null); // { id, name }

  const handleCreate = () => {
    if (newRoleName.trim()) {
      onCreate(newRoleName.trim());
      setNewRoleName('');
    }
  };

  const handleStartEdit = (role) => {
    setEditingRole({ ...role });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
  };

  const handleSaveEdit = () => {
    if (editingRole && editingRole.name.trim()) {
      onSave(editingRole);
      setEditingRole(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Role Form */}
      <div>
        <h4 className="text-lg font-medium text-gray-800 mb-2">Create New Role</h4>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="New role name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
            <Plus size={18} className="mr-1" /> Add
          </button>
        </div>
      </div>

      {/* Roles List */}
      <div>
        <h4 className="text-lg font-medium text-gray-800 mb-2">Existing Roles</h4>
        <div className="space-y-2">
          {roles.map(role => (
            <div key={role.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
              {editingRole && editingRole.id === role.id ? (
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="flex-grow px-2 py-1 border border-gray-300 rounded-md"
                />
              ) : (
                <span className="text-gray-700">{role.name}</span>
              )}

              <div className="flex items-center space-x-2">
                {editingRole && editingRole.id === role.id ? (
                  <>
                    <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800">Save</button>
                    <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-800">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleStartEdit(role)} className="text-blue-600 hover:text-blue-800 p-1">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => onDelete(role)} className="text-red-600 hover:text-red-800 p-1">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RolesManager;
