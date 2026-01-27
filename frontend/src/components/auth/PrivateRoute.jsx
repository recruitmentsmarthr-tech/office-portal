import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading user details...</div>;
  }

  if (!user || user.role !== requiredRole) {
    // You can redirect to a dashboard or show an access denied message
    return <Navigate to="/dashboard" replace />;
    // Or return an "Access Denied" component:
    // return <AccessDenied />;
  }

  return children;
};

export default PrivateRoute;
