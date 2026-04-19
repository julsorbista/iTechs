import React from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import logo from '../../assets/logo.png';

const getUserDisplay = (user) => {
  if (!user) {
    return {
      label: 'Player',
      handle: '@player',
    };
  }

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const label = fullName || user.username || user.email || 'Player';
  const handle = user.username
    ? `@${user.username}`
    : user.email || 'Student account';

  return { label, handle };
};

const StudentMenuTopbar = ({
  user,
  title = 'Menu',
  kicker = 'Student',
  description = '',
  onBack,
  backLabel = 'Menu',
  onLogout,
  leftBadgeLabel = 'Student Mode',
}) => {
  const userDisplay = getUserDisplay(user);
  const userInitial = userDisplay.label.trim().charAt(0).toUpperCase() || 'P';

  return (
    <header className="student-topbar">
      <div className="student-topbar-side">
        {onBack ? (
          <button type="button" onClick={onBack} className="student-topbar-back">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
        ) : (
          <div className="student-pill student-pill-muted">{leftBadgeLabel}</div>
        )}
      </div>

      <div className="student-topbar-brand">
        <div className="student-topbar-logo">
          <img src={logo} alt="iTECHS Logo" className="h-9 w-9 object-contain" />
        </div>
        <div className="student-topbar-copy">
          <p className="student-eyebrow">{kicker}</p>
          <h1 className="student-topbar-title">{title}</h1>
          {description && <p className="student-topbar-description">{description}</p>}
        </div>
      </div>

      <div className="student-topbar-side student-topbar-side-end">
        <div className="student-profile-chip" title={userDisplay.label}>
          <span className="student-profile-avatar">{userInitial}</span>
          <div className="student-profile-copy">
            <span className="student-profile-label">{userDisplay.label}</span>
            <span className="student-profile-handle">{userDisplay.handle}</span>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="student-topbar-icon"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
};

export default StudentMenuTopbar;
