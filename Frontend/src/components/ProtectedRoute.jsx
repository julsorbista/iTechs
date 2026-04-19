import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ 
  children, 
  allowedRoles = [], 
  requireAuth = true,
  redirectTo = '/'
}) => {
  const { isAuthenticated, isLoading, user, hasAnyRole } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div>
        <LoadingSpinner />
      </div>
    );
  }

  // If route requires authentication but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If user is authenticated but doesn't have required role
  if (
    isAuthenticated && 
    allowedRoles.length > 0 && 
    !hasAnyRole(allowedRoles)
  ) {
    // Redirect based on user role
    const roleRedirects = {
      STUDENT: '/student',
      TEACHER: '/teacher',
      SUPER_ADMIN: '/admin',
    };
    
    const redirectPath = roleRedirects[user?.role] || '/';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
