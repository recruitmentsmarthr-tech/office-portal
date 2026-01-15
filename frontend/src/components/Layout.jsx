import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Database, Shield, LogOut, User } from 'lucide-react';

function Layout({ user, onLogout, children }) {
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Vectors', href: '/vectors', icon: Database },
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-[#f0f4f9] border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Office Portal</h2>
        </div>
        <nav className="flex-1 p-6 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center p-3 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <item.icon size={20} className="mr-3" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <User size={24} className="mr-3 text-gray-600" />
            <span className="text-gray-800 font-medium">{user?.sub || 'User'}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 bg-white overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default Layout;
