import React from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';

const Layout = ({ children, title, showHeader = true }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const getRoleName = (role) => {
    const names = {
      STUDENT: 'Student',
      TEACHER: 'Teacher',
      SUPER_ADMIN: 'Administrator',
    };
    return names[role] || role;
  };

  return (
    <div className="app-shell page-enter">
      {showHeader && (
        <header className="px-4 py-3 md:px-6 max-w-[1440px] mx-auto">
          <div className="game-header">
            <div>
              <h1 className="game-header-title">
                <img src={logo} alt="iTECHS Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-sm" />
                {title || 'iTECHS'}
              </h1>
              <p className="game-header-subtitle">System Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hud-chip">
                <span className="font-black text-gray-500 text-xs uppercase tracking-wider">Role</span>
                <span className="font-bold">{getRoleName(user?.role || 'GUEST')}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
            </div>
          </div>
        </header>
      )}
      <main className="w-full relative mx-auto max-w-[1440px] px-4 md:px-6 pb-6 pt-2">
        {children}
      </main>
    </div>
  );
};

export default Layout;
