import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Database, Shield, LogOut, User, Menu, X, MessageCircle } from 'lucide-react';

function Layout({ user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);  // Start open

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Vectors', href: '/vectors', icon: Database },
    { name: 'Chat With AI', href: '/chat', icon: MessageCircle },
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-[#f0f4f9] border-r border-gray-200 flex flex-col overflow-y-auto z-50 transform transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {sidebarOpen && <h2 className="text-xl font-bold text-gray-800">Office Portal</h2>}
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-gray-100">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                sidebarOpen ? 'justify-start' : 'justify-center'
              }`}
              title={!sidebarOpen ? item.name : undefined}  // Tooltip for collapsed state
            >
              <item.icon size={sidebarOpen ? 20 : 32} className={sidebarOpen ? 'mr-3' : ''} />
              {sidebarOpen && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center mb-4 ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
            <User size={sidebarOpen ? 24 : 24} className={sidebarOpen ? 'mr-3 text-gray-600' : 'text-gray-600'} />
            {sidebarOpen && <span className="text-gray-800 font-medium">{user?.sub || 'User'}</span>}
          </div>
          <button
            onClick={onLogout}
            className={`w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            }`}
          >
            <LogOut size={sidebarOpen ? 18 : 18} className={sidebarOpen ? 'mr-2' : ''} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        {/* Top Bar (No Toggle Button) */}
        <div className="bg-white shadow-sm p-4">
          <h1 className="text-xl font-semibold">Office Portal</h1>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
