import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Database, Shield, LogOut, User, Menu, X, MessageCircle } from 'lucide-react';

function Layout({ user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Vectors', href: '/vectors', icon: Database },
    { name: 'Chat With AI', href: '/chat', icon: MessageCircle },
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`bg-white shadow-lg flex flex-col z-50 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center p-4 h-16 border-b border-gray-200">
          {sidebarOpen && <h1 className="text-xl font-bold text-gray-800 ml-2">Office Portal</h1>}
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-gray-100 ml-auto">
            <div className="w-6 h-6 flex-shrink-0">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </div>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-2 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center p-3 rounded-lg transition-colors ${
                  sidebarOpen ? 'justify-start' : 'justify-center'
                } ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
              title={!sidebarOpen ? item.name : undefined}
            >
              <item.icon size={sidebarOpen ? 22 : 26} className={sidebarOpen ? 'mr-4' : ''} />
              {sidebarOpen && <span className="font-medium">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Profile / Logout */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center mb-4 ${sidebarOpen ? '' : 'justify-center'}`}>
            <User size={sidebarOpen ? 28 : 28} className={`p-1 rounded-full bg-gray-200 text-gray-600 ${sidebarOpen ? 'mr-3' : ''}`} />
            {sidebarOpen && (
              <div>
                <span className="text-gray-800 font-semibold block">{user?.sub || 'User'}</span>
                <span className="text-xs text-gray-500">{user?.role || 'user'}</span>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className={`bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors w-full flex items-center ${
              sidebarOpen ? 'py-2 px-4' : 'py-3 justify-center'
            }`}
          >
            <LogOut size={20} className={sidebarOpen ? 'mr-3' : ''} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}

export default Layout;
