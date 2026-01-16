import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Database, Shield, LogOut, User, Menu, X, MessageCircle } from 'lucide-react';

function Layout({ user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);  // Start open on desktop

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Vectors', href: '/vectors', icon: Database },
    { name: 'Chat With AI', href: '/chat', icon: MessageCircle },
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="flex h-screen">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-[#f0f4f9] border-r border-gray-200 flex flex-col overflow-y-auto z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Office Portal</h2>
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-gray-100">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        <nav className="flex-1 p-6 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center p-3 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => window.innerWidth < 768 && toggleSidebar()}  // Close on mobile link click
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
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top Bar for Mobile Hamburger */}
        <div className="md:hidden bg-white shadow-sm p-4 flex items-center">
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-gray-100">
            <Menu size={24} />
          </button>
          <h1 className="ml-4 text-xl font-semibold">Office Portal</h1>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
