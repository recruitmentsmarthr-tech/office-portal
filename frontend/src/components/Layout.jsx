import React, { useState } from 'react';
import { Menu, X, Home, Database, Shield, LogOut, User } from 'lucide-react';

function Layout({ user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Vectors', href: '/vectors', icon: Database },
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-md border-r border-white/20 shadow-xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-800">Office Portal</h2>
            <button onClick={toggleSidebar} className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="flex items-center px-4 py-3 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200 group"
              >
                <item.icon size={20} className="mr-3 group-hover:scale-110 transition-transform" />
                {item.name}
              </a>
            ))}
          </nav>
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center px-4 py-3 text-slate-700">
              <User size={20} className="mr-3" />
              <span className="font-medium">{user?.sub || 'User'}</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center w-full px-4 py-3 text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-200 group"
            >
              <LogOut size={20} className="mr-3 group-hover:scale-110 transition-transform" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={toggleSidebar}></div>}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Top Bar for Mobile */}
        <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm p-4 flex items-center">
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Menu size={24} />
          </button>
          <h1 className="ml-4 text-xl font-semibold text-slate-800">Office Portal</h1>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
