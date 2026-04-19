import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentPage = lazy(() => import('./pages/StudentPage'));
const StudentGameLevelsPage = lazy(() => import('./pages/StudentGameLevelsPage'));
const StudentGamePlayPage = lazy(() => import('./pages/StudentGamePlayPage'));
const TeacherPage = lazy(() => import('./pages/TeacherPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const TeacherLevelEditorPage = lazy(() => import('./pages/TeacherLevelEditorPage'));

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
            <p className="text-gray-600 mb-6">We apologize for the inconvenience. Please try reloading the page.</p>
            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-mono text-red-800 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading component for route transitions
const RouteLoader = () => (
  <div>
    <LoadingSpinner />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/login" element={<LoginPage />} />
                
                {/* Student Routes */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRoles={['STUDENT']}>
                      <StudentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/games/:gameType"
                  element={
                    <ProtectedRoute allowedRoles={['STUDENT']}>
                      <StudentGameLevelsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/games/:gameType/levels/:levelNumber/play"
                  element={
                    <ProtectedRoute allowedRoles={['STUDENT']}>
                      <StudentGamePlayPage />
                    </ProtectedRoute>
                  }
                />

                {/* Teacher Routes */}
                <Route
                  path="/teacher"
                  element={
                    <ProtectedRoute allowedRoles={['TEACHER', 'SUPER_ADMIN']}>
                      <TeacherPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher/level-editor"
                  element={
                    <ProtectedRoute allowedRoles={['TEACHER']}>
                      <TeacherLevelEditorPage />
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperAdminPage />
                    </ProtectedRoute>
                  }
                />
                {/* Role-based redirects */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleBasedRedirect />
                    </ProtectedRoute>
                  }
                />

                {/* Catch all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>

            {/* Toast notifications */}
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Role-based redirect component
const RoleBasedRedirect = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const roleRedirects = {
    STUDENT: '/student',
    TEACHER: '/teacher',
    SUPER_ADMIN: '/admin',
  };

  const redirectTo = roleRedirects[user.role] || '/';
  return <Navigate to={redirectTo} replace />;
};

// 404 Not Found component
const NotFound = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
      <p className="text-gray-600 mb-6">The page you're looking for doesn't exist or has been moved.</p>
      <div className="flex gap-3">
        <button 
          onClick={() => window.history.back()}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-all"
        >
          Go Back
        </button>
        <a 
          href="/"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all text-center"
        >
          Go Home
        </a>
      </div>
    </div>
  </div>
);

export default App;
