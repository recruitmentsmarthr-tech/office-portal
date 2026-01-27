import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
// jwtDecode no longer needed here as it's in AuthContext
import Layout from './components/Layout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import PrivateRoute from './components/auth/PrivateRoute'; // New import
import Dashboard from './components/dashboard/Dashboard';
import DocumentIngestion from './components/vectors/DocumentIngestion';
import Admin from './components/admin/Admin';
import ManageIngestedMeetings from './components/admin/ManageIngestedMeetings'; // New import
import Chat from './components/chat/Chat';
import MeetingChat from './components/chat/MeetingChat'; // New import
import Transcribe from './components/transcribe/Transcribe'; // New import
import { useAuth } from './context/AuthContext'; // New import

function App() {
  const { user, loading, login, logout } = useAuth(); // Use the hook
  const [currentSessionId, setCurrentSessionId] = useState(null); // New state for current chat session
  const navigate = useNavigate(); // Still needed here for direct navigation

  // useEffect and jwtDecode logic are now handled in AuthContext
  // login and logout functions are also from useAuth

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="App">
      {user ? (
        <Layout user={user} onLogout={logout}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/chat" element={<Chat user={user} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId} />} />
            <Route path="/transcribe" element={<Transcribe />} /> {/* New route */}
            
            {/* Admin Routes */}
            <Route path="/vectors" element={<PrivateRoute requiredRole="admin"><DocumentIngestion user={user} /></PrivateRoute>} />
            <Route path="/meeting-chat" element={<PrivateRoute requiredRole="admin"><MeetingChat user={user} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId} /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute requiredRole="admin"><Admin /></PrivateRoute>} />
            <Route path="/admin/ingested-meetings" element={<PrivateRoute requiredRole="admin"><ManageIngestedMeetings /></PrivateRoute>} />
            
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Layout>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={login} />} />
          <Route path="/register" element={<Register onLogin={login} />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </div>
  );
}

export default App;
