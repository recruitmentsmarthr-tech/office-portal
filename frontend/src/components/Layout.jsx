import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

function Layout({ user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        user={user}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
        {/* Top Bar for Mobile Hamburger */}
        <div className="md:hidden bg-white shadow-sm p-4 flex items-center">
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-gray-100">
            <Menu size={24} />
          </button>
          <h1 className="ml-4 text-xl font-semibold">Office Portal</h1>
        </div>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
