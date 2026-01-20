import React from 'react';
import { FileText, Database, Users } from 'lucide-react';

function StatCard({ icon, title, value, description }) {
  return (
    <div className="card p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-700">{title}</h3>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

function RecentDocumentItem({ name, date, status }) {
    const statusStyles = {
        COMPLETED: "bg-green-100 text-green-800",
        INDEXING: "bg-yellow-100 text-yellow-800",
        FAILED: "bg-red-100 text-red-800",
    }
    return (
        <li className="flex items-center justify-between py-3">
            <div className="flex items-center">
                <FileText className="text-gray-400 mr-3" size={18} />
                <div>
                    <p className="font-medium text-gray-800">{name}</p>
                    <p className="text-sm text-gray-500">{date}</p>
                </div>
            </div>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[status] || "bg-gray-100 text-gray-800"}`}>
                {status}
            </span>
        </li>
    );
}

function Dashboard({ user }) {
  // Mock data for demonstration purposes
  const recentDocuments = [
    { name: 'Q4_Financial_Report.pdf', date: 'Jan 15, 2026', status: 'COMPLETED' },
    { name: 'Employee_Handbook_2026.pdf', date: 'Jan 14, 2026', status: 'COMPLETED' },
    { name: 'Marketing_Strategy_v2.pdf', date: 'Jan 12, 2026', status: 'INDEXING' },
    { name: 'onboarding_docs.pdf', date: 'Jan 10, 2026', status: 'FAILED' },
  ];
  
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, {user?.username || 'User'}!</h1>
          <p className="mt-1 text-base text-gray-600">Here's a snapshot of your knowledge base.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard 
            icon={<FileText className="text-blue-500" size={24} />}
            title="Total Documents"
            value="1,482"
            description="+2 this week"
          />
          <StatCard 
            icon={<Database className="text-green-500" size={24} />}
            title="Total Vectors"
            value="2.1M"
            description="Across all documents"
          />
          <StatCard 
            icon={<Users className="text-purple-500" size={24} />}
            title="Users Active"
            value="27"
            description="In the last 24 hours"
          />
        </div>

        {/* Recent Documents */}
        <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Recent Documents</h3>
            <ul>
                {recentDocuments.map((doc, index) => (
                    <RecentDocumentItem key={index} {...doc} />
                ))}
            </ul>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;