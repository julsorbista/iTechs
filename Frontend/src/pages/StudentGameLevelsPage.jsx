import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  Lock,
  Play,
  Star,
} from 'lucide-react';
import { handleAPIError, levelAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { normalizeGameType } from '../utils/gameTracks';
import StudentActionButton from '../components/student/StudentActionButton';
import StudentGameOverlay from '../components/student/StudentGameOverlay';
import StudentMenuTopbar from '../components/student/StudentMenuTopbar';
import StudentShell from '../components/student/StudentShell';
import { getStudentGameTheme } from '../components/student/studentGameTheme';
import studentMenuBackground from '../../assets/Game/game_one/Background/background_menu.avif';
import { startStudentMenuLoop, stopStudentMenuLoop } from '../utils/studentMenuAudio';

const PANEL_TRANSITION = {
  initial: { opacity: 0, y: 18, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
};

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const getLevelStateLabel = (status) => {
  if (status === 'COMPLETED') {
    return 'Cleared';
  }

  if (status === 'LOCKED') {
    return 'Locked';
  }

  return 'Ready';
};

const StudentGameLevelsPage = () => {
  const navigate = useNavigate();
  const { gameType: routeGameType } = useParams();
  const { user, logout } = useAuth();
  const gameType = normalizeGameType(routeGameType);

  const [gameState, setGameState] = useState(null);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevelNumber, setSelectedLevelNumber] = useState(null);
  const [activeLevelNumber, setActiveLevelNumber] = useState(null);

  const loadLevels = useCallback(async () => {
    try {
      setLoading(true);
      const levelsResponse = await levelAPI.getMyLevels(gameType);

      if (levelsResponse.status === 'success') {
        const nextGameState = levelsResponse.data.game || null;
        const nextLevels = levelsResponse.data.levels || [];
        setGameState(nextGameState);
        setLevels(nextLevels);
        setSelectedLevelNumber((current) => {
          if (nextLevels.some((level) => level.levelNumber === current)) {
            return current;
          }

          const firstUnlocked = nextLevels.find((level) => level.status !== 'LOCKED');
          return firstUnlocked?.levelNumber || nextLevels[0]?.levelNumber || null;
        });
      }
    } catch (error) {
      toast.error(handleAPIError(error).message);
    } finally {
      setLoading(false);
    }
  }, [gameType]);

  useEffect(() => {
    if (!gameType) {
      navigate('/student', { replace: true });
      return undefined;
    }

    if (routeGameType !== gameType) {
      navigate(`/student/games/${gameType}`, { replace: true });
      return undefined;
    }

    loadLevels();
  }, [gameType, loadLevels, navigate, routeGameType]);

  useEffect(() => {
    setActiveLevelNumber(null);
  }, [gameType]);

  useEffect(() => {
    startStudentMenuLoop();
  }, []);

  useEffect(() => {
    if (activeLevelNumber) {
      stopStudentMenuLoop({ rewind: false });
      return;
    }

    startStudentMenuLoop();
  }, [activeLevelNumber]);

  const displayLevels = useMemo(
    () => [...levels].sort((left, right) => left.levelNumber - right.levelNumber),
    [levels],
  );

  useEffect(() => {
    if (!displayLevels.length) {
      setSelectedLevelNumber(null);
      return;
    }

    if (displayLevels.some((level) => level.levelNumber === selectedLevelNumber)) {
      return;
    }

    const firstUnlocked = displayLevels.find((level) => level.status !== 'LOCKED');
    setSelectedLevelNumber(firstUnlocked?.levelNumber || displayLevels[0].levelNumber);
  }, [displayLevels, selectedLevelNumber]);

  const selectedLevel = useMemo(() => (
    displayLevels.find((level) => level.levelNumber === selectedLevelNumber)
    || displayLevels[0]
    || null
  ), [displayLevels, selectedLevelNumber]);

  const canPlaySelectedLevel = Boolean(
    selectedLevel
    && selectedLevel.status !== 'LOCKED'
    && Boolean(gameState?.isAvailable),
  );

  const launchSelectedLevel = () => {
    if (!selectedLevel || !canPlaySelectedLevel) {
      return;
    }

    setActiveLevelNumber(selectedLevel.levelNumber);
  };

  const handleLogout = () => {
    stopStudentMenuLoop({ rewind: true });
    logout();
  };

  const theme = getStudentGameTheme(gameState?.gameType || gameType);
  const trackProgress = useMemo(() => {
    const totalLevels = displayLevels.length;
    const completedLevels = displayLevels.filter((level) => level.status === 'COMPLETED').length;
    const totalStars = displayLevels.reduce((sum, level) => sum + Number(level.bestStars || 0), 0);

    return {
      totalLevels,
      completedLevels,
      totalStars,
      percent: totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0,
    };
  }, [displayLevels]);

  return (
    <StudentShell backgroundImage={studentMenuBackground} className="student-shell-warm">
      <StudentMenuTopbar
        user={user}
        kicker="Student"
        title={gameState?.title || 'Levels'}
        onBack={() => navigate('/student')}
        backLabel="Menu"
        onLogout={handleLogout}
      />

      <main className="student-shell-main">
        {loading ? (
          <section className="student-panel student-empty-panel student-panel-full">
            <div className="student-spinner" />
            <p className="student-body-copy">Loading levels...</p>
          </section>
        ) : displayLevels.length === 0 ? (
          <section className="student-panel student-empty-panel student-panel-full">
            <span className="student-card-icon student-icon-slate">
              <Lock className="h-6 w-6" />
            </span>
            <h2 className="student-section-title">No Levels Yet</h2>
            <p className="student-body-copy">This track is not available right now.</p>
          </section>
        ) : (
          <motion.section className="student-levels-page-stack mx-auto flex w-full h-full min-h-0 flex-col gap-4" {...PANEL_TRANSITION}>
            <section className={clsx('student-panel text-left flex flex-col sm:flex-row items-center justify-between gap-4', `student-surface-${theme.tone}`)}>
              <div>
                <p className="student-eyebrow">{gameState?.label || 'Track'}</p>
                <h2 className="student-section-title">{gameState?.title || 'Levels'}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="student-inline-summary-card flex-row items-center gap-3 py-2 px-4 bg-white/40 border-white/50 border-2 rounded-2xl shadow-sm">
                  <span className="student-inline-summary-value text-xl font-black text-slate-800">{formatPercent(trackProgress.percent)}</span>
                  <span className="student-inline-summary-label text-[10px] font-bold uppercase tracking-widest text-slate-500">progress</span>
                </div>
                <div className="student-inline-summary-card flex-row items-center gap-3 py-2 px-4 bg-white/40 border-white/50 border-2 rounded-2xl shadow-sm">
                  <span className="student-inline-summary-value text-xl font-black text-slate-800">{trackProgress.completedLevels}</span>
                  <span className="student-inline-summary-label text-[10px] font-bold uppercase tracking-widest text-slate-500">cleared</span>
                </div>
                <div className="student-inline-summary-card flex-row items-center gap-3 py-2 px-4 bg-white/40 border-white/50 border-2 rounded-2xl shadow-sm">
                  <span className="student-inline-summary-value text-xl font-black text-slate-800">{trackProgress.totalStars}</span>
                  <span className="student-inline-summary-label text-[10px] font-bold uppercase tracking-widest text-slate-500">stars</span>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] flex-1 min-h-0 overflow-hidden">
              <div className="student-panel text-left flex flex-col flex-1 min-h-0 overflow-hidden">
                <p className="student-eyebrow shrink-0">Level Select</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 overflow-y-auto pr-3 pb-4 flex-1 content-start">
                  {displayLevels.map((level) => {
                    const isLocked = level.status === 'LOCKED';
                    const isSelected = selectedLevel?.levelNumber === level.levelNumber;

                    return (
                      <button
                        key={level.id}
                        type="button"
                        className={clsx(
                          'student-level-card text-left',
                          isSelected && 'student-level-card-active',
                          isLocked && 'student-level-card-locked',
                        )}
                        onClick={() => setSelectedLevelNumber(level.levelNumber)}
                      >
                        <div className="student-level-card-head">
                          <span className="student-eyebrow">Level</span>
                          <span className={clsx('student-pill', isLocked ? 'student-pill-muted' : `student-pill-${theme.tone}`)}>
                            {getLevelStateLabel(level.status)}
                          </span>
                        </div>

                        <div className="student-level-card-number">
                          {String(level.levelNumber).padStart(2, '0')}
                        </div>
                        <div className="student-level-card-title">{level.title}</div>

                        <div className="student-level-card-stars">
                          {[0, 1, 2].map((starIndex) => (
                            <Star
                              key={starIndex}
                              className={clsx('h-4 w-4', starIndex < level.bestStars && 'fill-current')}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={clsx('student-panel text-left', `student-surface-${theme.tone}`)}>
                <p className="student-eyebrow">Selected Level</p>
                <h3 className="student-section-title">
                  {selectedLevel ? `Level ${String(selectedLevel.levelNumber).padStart(2, '0')}` : 'Choose a level'}
                </h3>
                <p className="student-body-copy">{selectedLevel?.title || 'Select any level from the menu.'}</p>
                <p className="student-body-copy student-body-copy-tight">
                  {selectedLevel?.description || 'The selected mission description will appear here.'}
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="student-insight-row">
                    <span className="student-insight-label">Status</span>
                    <strong className="student-insight-value">{getLevelStateLabel(selectedLevel?.status)}</strong>
                  </div>
                  <div className="student-insight-row">
                    <span className="student-insight-label">Attempts</span>
                    <strong className="student-insight-value">{selectedLevel?.attemptsCount || 0}</strong>
                  </div>
                  <div className="student-insight-row">
                    <span className="student-insight-label">Best Stars</span>
                    <strong className="student-insight-value">{selectedLevel?.bestStars || 0}</strong>
                  </div>
                </div>

                <div className="mt-4">
                  <StudentActionButton
                    variant={canPlaySelectedLevel ? 'forest' : 'slate'}
                    className="student-button-inline"
                    onClick={launchSelectedLevel}
                    disabled={!canPlaySelectedLevel}
                  >
                    Start Level
                    {canPlaySelectedLevel && <Play className="h-4 w-4" />}
                    {canPlaySelectedLevel && <ChevronRight className="h-4 w-4" />}
                  </StudentActionButton>
                </div>
              </div>
            </section>
          </motion.section>
        )}
      </main>

      <AnimatePresence>
        {activeLevelNumber && (
          <StudentGameOverlay
            gameType={gameType}
            levelNumber={activeLevelNumber}
            onClose={() => setActiveLevelNumber(null)}
            onProgressSync={() => {
              loadLevels();
            }}
          />
        )}
      </AnimatePresence>
    </StudentShell>
  );
};

export default StudentGameLevelsPage;
