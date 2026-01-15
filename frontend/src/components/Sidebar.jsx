import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Home, Database, FileText, Settings, User, LogOut } from 'lucide-react';

function Sidebar({ isOpen, toggleSidebar, user, onLogout }) {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 md:translate-x-0 md:shadow-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Office Portal</h1>
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-md hover:bg-gray-100 transition duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Section: Hamburger + New Action */}
        <div className="p-4 border-b border-gray-200">
          <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 flex items-center justify-center">
            <span className="mr-2">+</span> New Action
          </button>
        </div>

        {/* Middle Section: Nav Links */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <Link
                to="/dashboard"
                className="flex items-center p-3 rounded-md hover:bg-gray-100 transition duration-200"
                onClick={toggleSidebar}
              >
                <Home size={18} className="mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/vectors"
                className="flex items-center p-3 rounded-md hover:bg-gray-100 transition duration-200"
                onClick={toggleSidebar}
              >
                <Database size={18} className="mr-3" />
                Manage Vectors
              </Link>
            </li>
            <li>
              <Link
                to="/audit"
                className="flex items-center p-3 rounded-md hover:bg-gray-100 transition duration-200"
                onClick={toggleSidebar}
              >
                <FileText size={18} className="mr-3" />
                Audit Logs
              </Link>
            </li>
            <li>
              <Link
                to="/settings"
                className="flex items-center p-3 rounded-md hover:bg-gray-100 transition duration-200"
                onClick={toggleSidebar}
              >
                <Settings size={18} className="mr-3" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        {/* Bottom Section: User Profile + Logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <User size={24} className="mr-3 text-gray-600" />
            <span className="text-gray-800 font-medium">{user?.sub || 'testuser'}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition duration-200 flex items-center justify-center"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
