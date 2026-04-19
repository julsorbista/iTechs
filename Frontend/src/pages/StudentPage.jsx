import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  ChevronRight,
  Gamepad2,
  LogOut,
  Settings2,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authAPI, handleAPIError, userAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StudentActionButton from '../components/student/StudentActionButton';
import StudentShell from '../components/student/StudentShell';
import { getStudentGameTheme } from '../components/student/studentGameTheme';
import { useStudentGameCatalog } from '../features/student/useStudentGameCatalog';
import studentMenuBackground from '../../assets/Game/game_one/Background/background_menu.avif';
import {
  consumeStudentMenuAudioPrimed,
  startStudentMenuLoop,
  stopStudentMenuLoop,
} from '../utils/studentMenuAudio';

const PANEL_TRANSITION = {
  initial: { opacity: 0, y: 18, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
};

const DEFAULT_PREFERENCES = Object.freeze({
  music: true,
  sfx: true,
});

const MENU_ITEMS = Object.freeze([
  { id: 'play', label: 'Play', Icon: Gamepad2, activeVariant: 'forest' },
  { id: 'shop', label: 'Shop', Icon: ShoppingBag, activeVariant: 'gold' },
  { id: 'progress', label: 'My Progress', Icon: BarChart3, activeVariant: 'sky' },
  { id: 'settings', label: 'Settings', Icon: Settings2, activeVariant: 'slate' },
]);

const REWARD_ITEMS = Object.freeze([
  {
    id: 'reward-1',
    name: 'Pixel Frame',
    description: 'Sample avatar frame with a warm arcade border.',
    price: 120,
    tag: 'Profile',
  },
  {
    id: 'reward-2',
    name: 'Hint Ticket',
    description: 'Sample support item that could unlock one extra hint.',
    price: 80,
    tag: 'Boost',
  },
  {
    id: 'reward-3',
    name: 'Keyboard Skin',
    description: 'Sample cosmetic card for a retro keyboard theme.',
    price: 160,
    tag: 'Theme',
  },
  {
    id: 'reward-4',
    name: 'Victory Badge',
    description: 'Sample badge reward for milestone completions.',
    price: 220,
    tag: 'Badge',
  },
  {
    id: 'reward-5',
    name: 'Forest Cursor',
    description: 'Sample cursor skin with a mossy pixel pointer.',
    price: 95,
    tag: 'Cursor',
  },
  {
    id: 'reward-6',
    name: 'Coin Booster',
    description: 'Sample consumable card for bonus point runs.',
    price: 140,
    tag: 'Boost',
  },
  {
    id: 'reward-7',
    name: 'Retro Nameplate',
    description: 'Sample profile plate styled like an arcade save slot.',
    price: 175,
    tag: 'Profile',
  },
  {
    id: 'reward-8',
    name: 'Lab Desk Pet',
    description: 'Sample cosmetic companion for the student dashboard.',
    price: 260,
    tag: 'Companion',
  },
  {
    id: 'reward-9',
    name: 'Jungle Theme Pack',
    description: 'Sample theme bundle with palette and panel accents.',
    price: 310,
    tag: 'Theme',
  },
  {
    id: 'reward-10',
    name: 'Champion Sticker Set',
    description: 'Sample collectible sticker set for top performers.',
    price: 130,
    tag: 'Collectible',
  },
]);

const SETTINGS_TABS = Object.freeze([
  { id: 'account', label: 'Account' },
  { id: 'course', label: 'Course' },
  { id: 'audio', label: 'Audio' },
]);

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const getTeacherDisplayName = (teacher) => {
  if (!teacher) {
    return '';
  }

  const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
  return fullName || teacher.username || 'Teacher';
};

const getProgressStatus = (game) => {
  const authoredLevels = Number(game?.authoredLevels || 0);
  const completedLevels = Number(game?.completedLevels || 0);

  if (!authoredLevels) {
    return 'Locked';
  }

  if (completedLevels >= authoredLevels) {
    return 'Completed';
  }

  if (completedLevels > 0) {
    return 'In Progress';
  }

  return 'Ready';
};

const getLevelDisplay = (game) => {
  const authoredLevels = Number(game?.authoredLevels || 0);
  const completedLevels = Number(game?.completedLevels || 0);

  if (!authoredLevels) {
    return '--';
  }

  if (completedLevels >= authoredLevels) {
    return `${authoredLevels}/${authoredLevels}`;
  }

  return `${Math.min(completedLevels + 1, authoredLevels)}/${authoredLevels}`;
};

const StudentPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activePanel, setActivePanel] = useState('play');
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseEnrollment, setCourseEnrollment] = useState({
    isLoading: true,
    teacher: null,
    courseCode: null,
  });
  const [isSubmittingCourseCode, setIsSubmittingCourseCode] = useState(false);
  const [pendingCourseAction, setPendingCourseAction] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('account');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem('studentMenuPreferences');
      return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
    } catch (error) {
      return DEFAULT_PREFERENCES;
    }
  });

  const {
    orderedGames,
    selectedGame,
    loading,
    focusedGameType,
    setFocusedGameType,
  } = useStudentGameCatalog();

  const playerName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || 'Player';
  const selectedTrack = selectedGame || orderedGames[0] || null;
  const selectedTheme = getStudentGameTheme(selectedTrack?.gameType);
  const quickTeacherName = courseEnrollment.teacher
    ? getTeacherDisplayName(courseEnrollment.teacher)
    : 'No teacher linked';

  const summary = useMemo(() => {
    const authoredLevels = orderedGames.reduce((sum, game) => sum + Number(game.authoredLevels || 0), 0);
    const completedLevels = orderedGames.reduce((sum, game) => sum + Number(game.completedLevels || 0), 0);
    const totalStars = orderedGames.reduce((sum, game) => sum + Number(game.totalStars || 0), 0);
    const overallProgress = authoredLevels > 0
      ? Math.round((completedLevels / authoredLevels) * 100)
      : 0;

    return {
      authoredLevels,
      completedLevels,
      totalStars,
      totalPoints: totalStars,
      overallProgress,
    };
  }, [orderedGames]);

  useEffect(() => {
    try {
      localStorage.setItem('studentMenuPreferences', JSON.stringify(preferences));
    } catch (error) {
      // Ignore local preference persistence failures.
    }
  }, [preferences]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const cleanups = [];

    const clearUnlockHandlers = () => {
      cleanups.splice(0).forEach((cleanup) => cleanup());
    };

    const attachUnlockHandlers = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const retryPlayback = async () => {
        const result = await startStudentMenuLoop();
        if (result.started) {
          clearUnlockHandlers();
        }
      };

      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, retryPlayback, { passive: true });
        cleanups.push(() => window.removeEventListener(eventName, retryPlayback));
      });
    };

    const initializeAudio = async () => {
      consumeStudentMenuAudioPrimed();
      const result = await startStudentMenuLoop();
      if (!disposed && result.blocked) {
        attachUnlockHandlers();
      }
    };

    initializeAudio();

    return () => {
      disposed = true;
      clearUnlockHandlers();
    };
  }, []);

  useEffect(() => {
    if (preferences.music) {
      startStudentMenuLoop();
      return;
    }

    stopStudentMenuLoop({ rewind: false });
  }, [preferences.music]);

  useEffect(() => {
    let cancelled = false;

    const loadCourseEnrollment = async () => {
      try {
        const response = await userAPI.getMyCourseEnrollment();
        if (cancelled || response.status !== 'success') {
          return;
        }

        setCourseEnrollment({
          isLoading: false,
          teacher: response.data.teacher || null,
          courseCode: response.data.courseCode || null,
        });
      } catch (error) {
        if (!cancelled) {
          setCourseEnrollment((current) => ({
            ...current,
            isLoading: false,
          }));
        }
      }
    };

    loadCourseEnrollment();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    stopStudentMenuLoop({ rewind: true });
    logout();
  };

  const openSelectedGame = () => {
    if (!selectedTrack) {
      return;
    }

    const isPlayable = selectedTrack.isAvailable && Number(selectedTrack.authoredLevels || 0) > 0;
    if (!isPlayable) {
      return;
    }

    navigate(`/student/games/${selectedTrack.gameType}`);
  };

  const togglePreference = (key) => {
    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleCourseCodeSubmit = async () => {
    const normalizedCourseCode = String(courseCodeInput || '').trim().toUpperCase();
    if (!normalizedCourseCode) {
      toast.error('Enter a valid course code first.');
      return;
    }

    try {
      setIsSubmittingCourseCode(true);

      const response = await userAPI.enrollWithCourseCode({
        courseCode: normalizedCourseCode,
      });

      if (response.status === 'success') {
        setCourseEnrollment((current) => ({
          ...current,
          teacher: response.data.teacher || null,
          courseCode: response.data.teacher?.courseCode || null,
        }));
        setCourseCodeInput('');
        toast.success(response.message || 'Course code saved.');
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      if (errorInfo.status === 409) {
        setPendingCourseAction({
          type: 'replace',
          courseCode: normalizedCourseCode,
        });
        return;
      }

      toast.error(errorInfo.message);
    } finally {
      setIsSubmittingCourseCode(false);
    }
  };

  const handleRemoveCourseCode = () => {
    if (!courseEnrollment.teacher) {
      toast.error('No course code is assigned yet.');
      return;
    }

    setPendingCourseAction({ type: 'remove' });
  };

  const cancelPendingCourseAction = () => {
    setPendingCourseAction(null);
  };

  const confirmPendingCourseAction = async () => {
    if (!pendingCourseAction) {
      return;
    }

    try {
      setIsSubmittingCourseCode(true);

      if (pendingCourseAction.type === 'replace') {
        const response = await userAPI.enrollWithCourseCode({
          courseCode: pendingCourseAction.courseCode,
          confirmProgressReset: true,
        });

        if (response.status === 'success') {
          setCourseEnrollment((current) => ({
            ...current,
            teacher: response.data.teacher || null,
            courseCode: response.data.teacher?.courseCode || null,
          }));
          setCourseCodeInput('');
          toast.success(response.message || 'Course code replaced.');
        }
      }

      if (pendingCourseAction.type === 'remove') {
        const response = await userAPI.removeCourseEnrollment({
          confirmProgressReset: true,
        });

        if (response.status === 'success') {
          setCourseEnrollment((current) => ({
            ...current,
            teacher: null,
            courseCode: null,
          }));
          setCourseCodeInput('');
          toast.success(response.message || 'Course code removed.');
        }
      }

      setPendingCourseAction(null);
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    } finally {
      setIsSubmittingCourseCode(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Complete both password fields first.');
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.newPassword,
      });

      if (response.status === 'success') {
        setPasswordForm({ currentPassword: '', newPassword: '' });
        toast.success(response.message || 'Password changed successfully.');
      }
    } catch (error) {
      toast.error(handleAPIError(error).message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const renderPlay = () => (
    <motion.section key="play" className="student-content-stack" {...PANEL_TRANSITION}>
      {loading ? (
        <section className="student-panel student-empty-panel student-panel-full">
          <div className="student-spinner" />
          <p className="student-body-copy">Loading games...</p>
        </section>
      ) : (
        <section className="student-play-layout">
          <div className="student-panel student-play-games-panel">
            <div className="student-panel-head">
              <div>
                <p className="student-eyebrow">Game Menu</p>
                <h2 className="student-section-title">Play</h2>
              </div>
              <span className="student-pill student-pill-muted">{orderedGames.length} games</span>
            </div>

            <div className="student-play-track-grid">
              {orderedGames.map((game) => {
                const isActive = focusedGameType === game.gameType;

                return (
                  <button
                    key={game.gameType}
                    type="button"
                    className={clsx('student-track-button student-play-track-card', isActive && 'student-track-button-active')}
                    onClick={() => setFocusedGameType(game.gameType)}
                  >
                    <div className="student-play-track-copy">
                      <p className="student-compact-title">{game.shortTitle}</p>
                      <p className="student-compact-helper">{game.title}</p>
                    </div>
                    <div className="student-play-track-meta">
                      <span className="student-pill student-pill-muted">{getProgressStatus(game)}</span>
                      <span className="student-track-progress">{formatPercent(game.progressPercent)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={clsx('student-panel student-play-stage', `student-surface-${selectedTheme.tone}`)}>
            <div className="student-play-stage-header">
              <div>
                <p className="student-eyebrow">{selectedTrack?.label || 'Game'}</p>
                <h2 className="student-section-title">{selectedTrack?.title || 'Choose a game'}</h2>
                <p className="student-body-copy">
                  {selectedTrack?.description || 'Select one of the available games to start playing.'}
                </p>
              </div>
              <span className="student-pill student-pill-muted">{getProgressStatus(selectedTrack || {})}</span>
            </div>

            <div className="student-play-stage-bottom">
              <div className="student-play-stat-grid student-play-stat-grid-expanded">
                <div className="student-inline-summary-card">
                  <span className="student-inline-summary-value">{formatPercent(selectedTrack?.progressPercent)}</span>
                  <span className="student-inline-summary-label">progress</span>
                </div>
                <div className="student-inline-summary-card">
                  <span className="student-inline-summary-value">{selectedTrack?.completedLevels || 0}</span>
                  <span className="student-inline-summary-label">completed</span>
                </div>
                <div className="student-inline-summary-card">
                  <span className="student-inline-summary-value">{selectedTrack?.totalStars || 0}</span>
                  <span className="student-inline-summary-label">stars</span>
                </div>
                <div className="student-inline-summary-card">
                  <span className="student-inline-summary-value">{selectedTrack?.authoredLevels || 0}</span>
                  <span className="student-inline-summary-label">levels</span>
                </div>
              </div>

              <div className="student-play-actions-panel">
                <div className="student-play-meta">
                  <div>
                    <span className="student-play-meta-label">Next level</span>
                    <strong>{selectedTrack?.nextLevelNumber || '--'}</strong>
                  </div>
                  <div>
                    <span className="student-play-meta-label">Teacher</span>
                    <strong>{quickTeacherName}</strong>
                  </div>
                </div>

                <StudentActionButton
                  variant={selectedTrack?.isAvailable && Number(selectedTrack?.authoredLevels || 0) > 0 ? 'forest' : 'slate'}
                  className="student-button-inline student-play-cta"
                  onClick={openSelectedGame}
                  disabled={!selectedTrack || !selectedTrack.isAvailable || Number(selectedTrack.authoredLevels || 0) <= 0}
                >
                  Open Levels
                  <ChevronRight className="h-4 w-4" />
                </StudentActionButton>
              </div>
            </div>
          </div>
        </section>
      )}
    </motion.section>
  );

  const renderShop = () => (
    <motion.section key="shop" className="student-content-stack" {...PANEL_TRANSITION}>
      <section className="student-shop-layout">
        <div className="student-shop-summary-grid">
          <section className="student-panel student-shop-balance">
            <span className="student-shop-balance-label">Available points</span>
            <strong className="student-shop-balance-value student-points-accent">{summary.totalPoints}</strong>
            <p className="student-body-copy student-body-copy-tight">
              Sample reward pricing uses points so we can shape the store flow before the final economy is locked.
            </p>
          </section>

          <section className="student-panel student-shop-hero-card">
            <p className="student-eyebrow">Shop</p>
            <h2 className="student-section-title">Reward Booth</h2>
            <p className="student-body-copy">
              A fuller sample catalog is ready below. Think of this as a simple pixel e-commerce wall for cosmetics, boosts, and collectibles.
            </p>
          </section>
        </div>

        <section className="student-panel student-shop-panel h-full min-h-0 flex flex-col">
          <div className="student-shop-grid grid-cols-1 sm:grid-cols-2 flex-1 overflow-y-auto pr-2 pb-2">
            {REWARD_ITEMS.map((reward) => (
              <article key={reward.id} className="student-shop-card h-full min-h-[auto] justify-start content-start items-start text-left">
                <div className="w-full aspect-video rounded-xl overflow-hidden mb-2 border-2 border-white/20 bg-slate-800 shrink-0">
                  <img src={`https://placehold.co/400x225/1e293b/94a3b8?text=${reward.name.replace(/\s+/g, '+')}`} alt={reward.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="student-shop-card-top w-full justify-between mt-1">
                  <span className="student-pill student-pill-muted">{reward.tag}</span>
                  <span className="student-shop-price">
                    <strong className="student-points-accent">{reward.price}</strong>
                    <span>pts</span>
                  </span>
                </div>

                <div className="student-shop-card-copy w-full flex-1">
                  <h3 className="student-section-title text-start">{reward.name}</h3>
                  <p className="student-body-copy student-body-copy-tight text-start">{reward.description}</p>
                </div>

                <div className="student-shop-card-footer w-full justify-between items-center mt-auto pt-4 relative z-10">
                  <span className="student-shop-sample-note">Sample reward</span>
                  <StudentActionButton variant="gold" size="compact" className="student-button-inline" disabled>
                    Preview
                  </StudentActionButton>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </motion.section>
  );

  const renderProgress = () => (
    <motion.section key="progress" className="student-content-stack" {...PANEL_TRANSITION}>
      <section className="student-panel student-progress-table-panel">
        <div className="student-progress-table-header">
          <div>
            <p className="student-eyebrow">Tracker</p>
            <h2 className="student-section-title">My Progress</h2>
          </div>
          <div className="student-progress-summary-chips">
            <span>{summary.completedLevels}/{summary.authoredLevels} levels</span>
            <span>{summary.totalStars} stars</span>
            <span>{summary.overallProgress}% cleared</span>
          </div>
        </div>

        <div className="student-progress-table-wrap">
          <table className="student-progress-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Status</th>
                <th>Level</th>
                <th>Stars</th>
              </tr>
            </thead>
            <tbody>
              {orderedGames.map((game) => (
                <tr key={game.gameType}>
                  <td>{game.title}</td>
                  <td>{getProgressStatus(game)}</td>
                  <td>{getLevelDisplay(game)}</td>
                  <td>{game.totalStars || 0}</td>
                </tr>
              ))}
              {!orderedGames.length && (
                <tr>
                  <td colSpan={4}>No games available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </motion.section>
  );

  const renderSettingsContent = () => {
    if (activeSettingsTab === 'account') {
      return (
        <div className="student-settings-tab-content">
          <p className="student-eyebrow">Account</p>
          <h2 className="student-section-title">Account Settings</h2>

          <div className="student-settings-form">
            <label className="student-field">
              <span className="student-field-label">Old password</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                className="student-field-input"
                placeholder="Enter current password"
              />
            </label>

            <label className="student-field">
              <span className="student-field-label">New password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                className="student-field-input"
                placeholder="Enter new password"
              />
            </label>

            <StudentActionButton
              variant="gold"
              className="student-button-inline student-settings-submit"
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? 'Updating...' : 'Change Password'}
            </StudentActionButton>
          </div>
        </div>
      );
    }

    if (activeSettingsTab === 'course') {
      return (
        <div className="student-settings-tab-content">
          <p className="student-eyebrow">Course Code</p>
          <h2 className="student-section-title">{quickTeacherName}</h2>
          <p className="student-body-copy student-body-copy-tight">
            {courseEnrollment.isLoading
              ? 'Checking your current course link...'
              : courseEnrollment.courseCode
                ? `Current code: ${courseEnrollment.courseCode}`
                : 'No active course code.'}
          </p>

          <div className="student-settings-form">
            <label className="student-field">
              <span className="student-field-label">Enter Course Code</span>
              <input
                type="text"
                value={courseCodeInput}
                onChange={(event) => setCourseCodeInput(event.target.value.toUpperCase())}
                placeholder="COURSE-123"
                maxLength={32}
                className="student-field-input"
              />
            </label>

            <div className="student-inline-actions">
              <StudentActionButton
                variant="forest"
                size="compact"
                className="student-button-inline"
                onClick={handleCourseCodeSubmit}
                disabled={isSubmittingCourseCode}
              >
                {courseEnrollment.teacher ? 'Replace Code' : 'Add Code'}
              </StudentActionButton>

              {courseEnrollment.teacher && (
                <StudentActionButton
                  variant="slate"
                  size="compact"
                  className="student-button-inline student-button-danger"
                  onClick={handleRemoveCourseCode}
                  disabled={isSubmittingCourseCode}
                >
                  Remove Link
                </StudentActionButton>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="student-settings-tab-content">
        <p className="student-eyebrow">Audio</p>
        <h2 className="student-section-title">Menu Sound</h2>

        <div className="student-settings-audio-stack">
          <div className="student-setting-card">
            <div className="student-setting-copy">
              <span className={clsx('student-card-icon', preferences.music ? 'student-icon-emerald' : 'student-icon-slate')}>
                {preferences.music ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </span>
              <div>
                <h3 className="student-setting-title">Music</h3>
                <p className="student-body-copy student-body-copy-tight">Background music in the menu.</p>
              </div>
            </div>
            <StudentActionButton
              variant={preferences.music ? 'forest' : 'slate'}
              size="compact"
              className="student-button-inline"
              onClick={() => togglePreference('music')}
            >
              {preferences.music ? 'On' : 'Off'}
            </StudentActionButton>
          </div>

          <div className="student-setting-card">
            <div className="student-setting-copy">
              <span className={clsx('student-card-icon', preferences.sfx ? 'student-icon-sky' : 'student-icon-slate')}>
                {preferences.sfx ? <Sparkles className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </span>
              <div>
                <h3 className="student-setting-title">Sound FX</h3>
                <p className="student-body-copy student-body-copy-tight">Button and interface sounds.</p>
              </div>
            </div>
            <StudentActionButton
              variant={preferences.sfx ? 'sky' : 'slate'}
              size="compact"
              className="student-button-inline"
              onClick={() => togglePreference('sfx')}
            >
              {preferences.sfx ? 'On' : 'Off'}
            </StudentActionButton>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <motion.section key="settings" className="student-content-stack" {...PANEL_TRANSITION}>
      <section className="student-settings-workspace">
        <div className="student-panel student-settings-card student-settings-tabs-panel">
          <div>
            <p className="student-eyebrow">Settings</p>
            <h2 className="student-section-title">Preferences</h2>
          </div>

          <div className="student-settings-tabs">
            {SETTINGS_TABS.map((tab) => (
              <StudentActionButton
                key={tab.id}
                variant={activeSettingsTab === tab.id ? 'gold' : 'slate'}
                className="student-settings-tab-button"
                contentClassName="justify-center"
                onClick={() => setActiveSettingsTab(tab.id)}
              >
                {tab.label}
              </StudentActionButton>
            ))}
          </div>
        </div>

        <div className="student-panel student-settings-card student-settings-stage">
          {renderSettingsContent()}
        </div>
      </section>
    </motion.section>
  );

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'shop':
        return renderShop();
      case 'progress':
        return renderProgress();
      case 'settings':
        return renderSettings();
      case 'play':
      default:
        return renderPlay();
    }
  };

  return (
    <StudentShell backgroundImage={studentMenuBackground} className="student-shell-warm">
      <main className="student-shell-main student-shell-main-compact">
        <section className="student-shell-layout">
          <aside className="student-menu-rail">
            <div className="student-menu-rail-head">
              <p className="student-eyebrow">Menu</p>
              <h1 className="student-hero-title">iTech</h1>
            </div>

            <div className="student-menu-rail-buttons">
              {MENU_ITEMS.map(({ id, label, Icon, activeVariant }) => {
                const isActive = activePanel === id;

                return (
                  <StudentActionButton
                    key={id}
                    variant={isActive ? activeVariant : 'slate'}
                    className="student-menu-rail-action"
                    contentClassName="justify-center"
                    onClick={() => setActivePanel(id)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </StudentActionButton>
                );
              })}
            </div>

            <div className="student-menu-rail-footer">
              <div className="student-menu-account-card">
                <span className="student-menu-account-label">Student</span>
                <strong className="student-menu-account-name">{playerName}</strong>
              </div>

              <StudentActionButton
                variant="slate"
                size="compact"
                className="student-menu-logout-button"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </StudentActionButton>
            </div>
          </aside>

          <div className="student-shell-content">
            <AnimatePresence mode="wait">
              {renderActivePanel()}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {pendingCourseAction && (
        <div className="student-modal-backdrop">
          <div className="student-modal-card">
            <div className="student-panel-head">
              <div>
                <p className="student-eyebrow">Progress Reset Warning</p>
                <h3 className="student-section-title">
                  {pendingCourseAction.type === 'replace' ? 'Replace Course Code?' : 'Remove Course Code?'}
                </h3>
              </div>
            </div>

            <p className="student-body-copy">
              This action will remove your saved stars, attempts, and current level progression. It cannot be undone.
            </p>

            <div className="student-inline-actions mt-4">
              <StudentActionButton
                variant="slate"
                size="compact"
                className="student-button-inline"
                onClick={cancelPendingCourseAction}
                disabled={isSubmittingCourseCode}
              >
                Cancel
              </StudentActionButton>
              <StudentActionButton
                variant="forest"
                size="compact"
                className="student-button-inline student-button-danger"
                onClick={confirmPendingCourseAction}
                disabled={isSubmittingCourseCode}
              >
                {isSubmittingCourseCode ? 'Applying...' : 'Yes, Reset Progress'}
              </StudentActionButton>
            </div>
          </div>
        </div>
      )}
    </StudentShell>
  );
};

export default StudentPage;
