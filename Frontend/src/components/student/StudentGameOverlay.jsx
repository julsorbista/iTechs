import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowUp,
  Gamepad2,
  Loader2,
  LogOut,
  Sparkles,
  Target,
} from 'lucide-react';
import { handleAPIError, levelAPI } from '../../utils/api';
import { normalizeGameType } from '../../utils/gameTracks';
import { useAuth } from '../../context/AuthContext';
import GameCanvas from '../../games/game-one/ui/GameCanvas';
import GameCanvasGameTwo from '../../games/game-two/ui/GameCanvasGameTwo';
import GameCanvasGameThree from '../../games/game-three/ui/GameCanvasGameThree';
import StudentActionButton from './StudentActionButton';
import StudentMenuTopbar from './StudentMenuTopbar';
import StudentShell from './StudentShell';
import { gameOneRuntimeAssets } from '../../games/game-one/assets/manifest/runtimeAssets';
import { PLATFORM_TILE_BY_KEY } from '../../features/level-editor/platformTileCatalog';
import { buildSubmissionPayload as buildGameOneSubmissionPayload } from '../../games/game-one/systems/progressBridge';
import { buildSubmissionPayload as buildGameTwoSubmissionPayload } from '../../games/game-two/systems/progressBridge';
import { buildSubmissionPayload as buildGameThreeSubmissionPayload } from '../../games/game-three/systems/progressBridge';
import studentMenuBackground from '../../../assets/Game/game_one/Background/background_menu.avif';

const DEFAULT_ROOM_BACKGROUND_COLOR = '#111827';
const MAX_RUNTIME_TILE_SIZE = 1024;
const MAX_RUNTIME_TILE_Z_INDEX = 9999;
const MIN_RUNTIME_TILE_ROTATION = 0;
const MAX_RUNTIME_TILE_ROTATION = 359;

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const normalizeHexColor = (value, fallback = DEFAULT_ROOM_BACKGROUND_COLOR) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : fallback;
};

const toRuntimeTileTextureKey = (tileId, index) => {
  const safeTileId = typeof tileId === 'string' && tileId.trim()
    ? tileId.trim()
    : `tile-${index + 1}`;

  return `runtime-bg-${safeTileId}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
};

const hydratePlayableGameOneLevelData = (rawLevelData) => {
  if (!rawLevelData || typeof rawLevelData !== 'object') {
    return rawLevelData;
  }

  const viewportWidth = Math.max(1, Number(rawLevelData?.viewport?.width) || 1280);
  const viewportHeight = Math.max(1, Number(rawLevelData?.viewport?.height) || 720);
  const worldObjects = rawLevelData.worldObjects && typeof rawLevelData.worldObjects === 'object'
    ? rawLevelData.worldObjects
    : {};
  const rawBackgroundTiles = Array.isArray(worldObjects.backgroundTiles)
    ? worldObjects.backgroundTiles
    : [];

  const resolvedBackgroundTiles = rawBackgroundTiles
    .map((tile, index) => {
      if (!tile || typeof tile !== 'object') {
        return null;
      }

      const tileKey = typeof tile.tileKey === 'string' ? tile.tileKey.trim() : '';
      if (!tileKey) {
        return null;
      }

      const visual = PLATFORM_TILE_BY_KEY[tileKey];
      const imageUrl = typeof tile.imageUrl === 'string' && tile.imageUrl.trim()
        ? tile.imageUrl.trim()
        : visual?.url;
      if (!imageUrl) {
        return null;
      }

      const id = typeof tile.id === 'string' && tile.id.trim()
        ? tile.id.trim().slice(0, 120)
        : `tile-${index + 1}`;

      return {
        id,
        tileKey,
        imageUrl,
        textureKey: typeof tile.textureKey === 'string' && tile.textureKey.trim()
          ? tile.textureKey.trim().slice(0, 140)
          : toRuntimeTileTextureKey(id, index),
        x: clampNumber(tile.x, 0, viewportWidth * 80, Math.round(viewportWidth * 0.5)),
        y: clampNumber(tile.y, 0, viewportHeight * 80, Math.round(viewportHeight * 0.5)),
        size: clampNumber(tile.size, 16, MAX_RUNTIME_TILE_SIZE, 96),
        zIndex: clampNumber(tile.zIndex, 0, MAX_RUNTIME_TILE_Z_INDEX, index),
        rotationDeg: clampNumber((((Math.round(Number(tile.rotationDeg) || 0) % 360) + 360) % 360), MIN_RUNTIME_TILE_ROTATION, MAX_RUNTIME_TILE_ROTATION, 0),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
        blendMode: String(tile.blendMode || visual?.blendMode || '').trim().toLowerCase() === 'screen'
          ? 'screen'
          : 'normal',
        __sourceIndex: index,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex) {
        return left.zIndex - right.zIndex;
      }

      return left.__sourceIndex - right.__sourceIndex;
    })
    .map(({ __sourceIndex, ...tile }) => tile);

  const cells = Array.isArray(rawLevelData?.grid?.cells)
    ? rawLevelData.grid.cells.map((cell) => ({
        ...cell,
        backgroundColor: normalizeHexColor(cell?.backgroundColor),
      }))
    : [];

  return {
    ...rawLevelData,
    grid: {
      ...(rawLevelData.grid || {}),
      cells,
    },
    worldObjects: {
      ...worldObjects,
      backgroundTiles: resolvedBackgroundTiles,
    },
  };
};

const getLevelObjective = (levelData, normalizedGameType) => {
  if (levelData?.objective) {
    return levelData.objective;
  }

  if (levelData?.subtitle) {
    return levelData.subtitle;
  }

  if (Array.isArray(levelData?.rooms)) {
    return levelData.rooms.find((room) => room?.objective)?.objective
      || 'Clear each room objective and reach the portal to finish the level.';
  }

  if (normalizedGameType === 'GAME_TWO') {
    return 'Place each component in the correct slot, then answer the quiz to earn points.';
  }

  if (normalizedGameType === 'GAME_THREE') {
    return 'Match every pair and answer each revealed question to earn points.';
  }

  return 'Complete the level objective and reach the exit portal.';
};

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

const StudentGameOverlay = ({
  gameType,
  levelNumber,
  onClose,
  onProgressSync,
}) => {
  const { user, logout } = useAuth();
  const normalizedGameType = normalizeGameType(gameType);
  const [currentLevelNumber, setCurrentLevelNumber] = useState(Number(levelNumber));
  const numericLevelNumber = Number(currentLevelNumber);

  const [sessionInfo, setSessionInfo] = useState(null);
  const [levelData, setLevelData] = useState(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState('');
  const [runNonce, setRunNonce] = useState(0);
  const [gameplayData, setGameplayData] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextLevelAvailable, setNextLevelAvailable] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  const isGameTwo = normalizedGameType === 'GAME_TWO';
  const isGameThree = normalizedGameType === 'GAME_THREE';
  const isSidebarLayout = isGameTwo || isGameThree;
  const levelObjective = getLevelObjective(levelData, normalizedGameType);
  const canAdvanceLevel = Boolean(resultData?.result === 'COMPLETED' && nextLevelAvailable);
  const userDisplay = useMemo(() => getUserDisplay(user), [user]);
  const userInitial = userDisplay.label.trim().charAt(0).toUpperCase() || 'P';
  const gameThreeViewportWidth = viewportSize.width >= 1180
    ? Math.max(360, viewportSize.width - 470)
    : Math.max(320, viewportSize.width - 120);

  const controlsText = useMemo(() => (
    isGameTwo
      ? [
        { label: 'Drag parts', Icon: Gamepad2 },
        { label: 'Drop to slot', Icon: ArrowUp },
        { label: 'Answer quiz', Icon: Sparkles },
      ]
      : isGameThree
        ? [
          { label: 'Flip cards', Icon: Gamepad2 },
          { label: 'Match pairs', Icon: Sparkles },
          { label: 'Answer quiz', Icon: Target },
        ]
      : [
        { label: 'Move', Icon: Gamepad2 },
        { label: 'Jump', Icon: ArrowUp },
        { label: 'Attack (J)', Icon: Sparkles },
      ]
  ), [isGameThree, isGameTwo]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setCurrentLevelNumber(Number(levelNumber));
    setGameplayData(null);
    setResultData(null);
    setStartError('');
    setRunNonce(0);
  }, [levelNumber]);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!normalizedGameType) {
      setLevelData(null);
      setSessionInfo(null);
      setStarting(false);
      setStartError('That level is not available yet.');
      return undefined;
    }

    let cancelled = false;

    const prepareLevel = async () => {
      try {
        setStarting(true);
        setStartError('');
        setSessionInfo(null);
        setLevelData(null);
        setNextLevelAvailable(false);

        const [contentResponse, nextContentResult] = await Promise.all([
          levelAPI.getPlayableLevelContent(normalizedGameType, numericLevelNumber),
          levelAPI.getPlayableLevelContent(normalizedGameType, numericLevelNumber + 1, { prefetch: true })
            .catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        if (contentResponse.status !== 'success' || !contentResponse.data?.levelData) {
          throw new Error('That level is not available yet.');
        }

        const playableLevelData = contentResponse.data.levelData;
        const hydratedLevelData = normalizedGameType === 'GAME_ONE'
          ? hydratePlayableGameOneLevelData(playableLevelData)
          : playableLevelData;

        setLevelData(hydratedLevelData);
        setNextLevelAvailable(Boolean(
          nextContentResult?.status === 'success' && nextContentResult?.data?.levelData,
        ));

        const sessionResponse = await levelAPI.startLevelSession(
          normalizedGameType,
          playableLevelData.levelNumber,
        );

        if (!cancelled && sessionResponse.status === 'success') {
          setSessionInfo(sessionResponse.data);
        }
      } catch (error) {
        if (!cancelled) {
          const errorInfo = handleAPIError(error);
          setStartError(errorInfo.message);
          toast.error(errorInfo.message);
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    };

    prepareLevel();

    return () => {
      cancelled = true;
    };
  }, [normalizedGameType, numericLevelNumber, runNonce]);

  const frameSize = useMemo(() => {
    if (!levelData) {
      return { width: 0, height: 0 };
    }

    const aspectRatio = levelData.viewport.width / levelData.viewport.height;
    const availableWidth = Math.max(320, viewportSize.width - 120);
    const availableHeight = Math.max(240, viewportSize.height - 220);
    const width = Math.min(availableWidth, availableHeight * aspectRatio);

    return {
      width,
      height: width / aspectRatio,
    };
  }, [levelData, viewportSize]);

  const handleExitRequest = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleLogout = useCallback(() => {
    onClose?.();
    logout();
  }, [logout, onClose]);

  const submitOutcome = useCallback(async (gameplay) => {
    if (!sessionInfo || isSubmitting || resultData) {
      return;
    }

    setGameplayData(gameplay);
    setIsSubmitting(true);

    try {
      const submissionPayload = isGameTwo
        ? buildGameTwoSubmissionPayload(gameplay)
        : isGameThree
          ? buildGameThreeSubmissionPayload(gameplay, sessionInfo)
          : buildGameOneSubmissionPayload(gameplay);

      const response = await levelAPI.submitLevelSession(
        normalizedGameType,
        sessionInfo.levelNumber,
        sessionInfo.sessionId,
        submissionPayload,
      );

      if (response.status === 'success') {
        setResultData(response.data);
        onProgressSync?.(response.data);
        toast.success(
          response.data.result === 'COMPLETED'
            ? isGameTwo
              ? `Level cleared. Points: ${Number(gameplay?.points || 0)} | Stars earned: ${response.data.starsEarned}`
              : `Level cleared. Stars earned: ${response.data.starsEarned}`
            : 'Attempt recorded. Retry the level to keep progressing.',
        );
      }
    } catch (error) {
      toast.error(handleAPIError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isGameThree, isGameTwo, isSubmitting, normalizedGameType, onProgressSync, resultData, sessionInfo]);

  const handleRetry = useCallback(() => {
    setGameplayData(null);
    setResultData(null);
    setStartError('');
    setSessionInfo(null);
    setLevelData(null);
    setStarting(true);
    setRunNonce((value) => value + 1);
  }, []);

  const handleNextLevel = useCallback(() => {
    if (!nextLevelAvailable) {
      return;
    }

    setGameplayData(null);
    setResultData(null);
    setStartError('');
    setSessionInfo(null);
    setLevelData(null);
    setStarting(true);
    setCurrentLevelNumber((value) => value + 1);
  }, [nextLevelAvailable]);

  return (
    <motion.div
      className="student-game-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <StudentShell backgroundImage={studentMenuBackground} className="student-shell-overlay">
        {!isSidebarLayout && (
          <StudentMenuTopbar
            user={user}
            kicker="Student"
            title={levelData?.title || `Level ${String(numericLevelNumber).padStart(2, '0')}`}
            onBack={onClose}
            backLabel="Levels"
            onLogout={handleLogout}
          />
        )}

        <main className={`student-shell-main ${isSidebarLayout ? 'student-shell-main-game-three' : ''}`}>
          {starting ? (
            <section className="student-panel student-empty-panel student-panel-full">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
              <p className="student-body-copy">Preparing level...</p>
            </section>
          ) : startError || !sessionInfo || !levelData ? (
            <section className="student-panel student-empty-panel student-panel-full">
              <span className="student-card-icon student-icon-slate">
                <Target className="h-6 w-6" />
              </span>
              <h2 className="student-section-title">Level Unavailable</h2>
              <p className="student-body-copy">{startError || 'This level cannot be played right now.'}</p>
              <StudentActionButton variant="slate" className="student-button-inline" onClick={onClose}>
                Return
              </StudentActionButton>
            </section>
          ) : isSidebarLayout ? (
            <section className="student-game-three-overlay-layout">
              <aside className="student-panel student-game-three-sidebar">
                <div className="student-game-three-sidebar-block">
                  <p className="student-eyebrow">{sessionInfo.gameType}</p>
                  <h2 className="student-section-title">{levelData.title}</h2>
                  <p className="student-body-copy student-body-copy-tight">
                    {levelData.subtitle || levelObjective}
                  </p>
                </div>

                <div className="student-game-three-sidebar-actions">
                  <StudentActionButton variant="sky" size="compact" onClick={onClose}>
                    <ArrowLeft className="h-4 w-4" />
                    Levels
                  </StudentActionButton>
                  <StudentActionButton variant="slate" size="compact" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    Logout
                  </StudentActionButton>
                </div>

                <div className="student-profile-chip" title={userDisplay.label}>
                  <span className="student-profile-avatar">{userInitial}</span>
                  <div className="student-profile-copy">
                    <span className="student-profile-label">{userDisplay.label}</span>
                    <span className="student-profile-handle">{userDisplay.handle}</span>
                  </div>
                </div>

                <div className="student-game-three-sidebar-grid">
                  <div className="student-inline-summary-card">
                    <span className="student-inline-summary-label">retry</span>
                    <span className="student-inline-summary-value">x{sessionInfo.retryMultiplier}</span>
                  </div>
                  <div className="student-inline-summary-card">
                    <span className="student-inline-summary-label">level</span>
                    <span className="student-inline-summary-value">
                      {String(numericLevelNumber).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="student-inline-summary-card">
                    <span className="student-inline-summary-label">pairs</span>
                    <span className="student-inline-summary-value">
                      {Array.isArray(levelData?.pairs) ? levelData.pairs.length : 0}
                    </span>
                  </div>
                  <div className="student-inline-summary-card">
                    <span className="student-inline-summary-label">next</span>
                    <span className="student-inline-summary-value">
                      {nextLevelAvailable ? 'ready' : 'none'}
                    </span>
                  </div>
                </div>

                <div className="student-game-three-sidebar-block">
                  <p className="student-eyebrow">Objective</p>
                  <p className="student-body-copy student-body-copy-tight">{levelObjective}</p>
                </div>

                <div className="student-game-three-sidebar-block">
                  <p className="student-eyebrow">Controls</p>
                  <div className="student-game-three-sidebar-controls">
                    {controlsText.map(({ label, Icon }) => (
                      <span key={label} className="student-game-three-control-item">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </aside>

              <section className="student-panel student-game-three-frame-panel" style={isGameTwo ? { padding: 0, background: 'transparent', boxShadow: 'none', border: 'none' } : {}}>
                {isGameTwo ? (
                  <div className="student-game-frame-wrap" style={{width: '100%', height: '100%', minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <div
                      className="student-game-frame-shell"
                      style={{
                        width: `${frameSize.width}px`,
                        maxWidth: '100%',
                      }}
                    >
                      <GameCanvasGameTwo
                        key={sessionInfo.sessionId}
                        levelData={levelData}
                        onLevelComplete={submitOutcome}
                        onLevelFail={submitOutcome}
                        onExitRequest={handleExitRequest}
                        resultData={resultData}
                        gameplayData={gameplayData}
                        isSubmitting={isSubmitting}
                        canAdvanceLevel={canAdvanceLevel}
                        onRetry={handleRetry}
                        onBack={onClose}
                        onNextLevel={handleNextLevel}
                      />
                    </div>
                  </div>
                ) : (
                  <GameCanvasGameThree
                    key={sessionInfo.sessionId}
                    levelData={levelData}
                    viewportWidth={gameThreeViewportWidth}
                    onLevelComplete={submitOutcome}
                    onExitRequest={handleExitRequest}
                    resultData={resultData}
                    gameplayData={gameplayData}
                    isSubmitting={isSubmitting}
                    canAdvanceLevel={canAdvanceLevel}
                    onRetry={handleRetry}
                    onBack={onClose}
                    onNextLevel={handleNextLevel}
                  />
                )}
              </section>
            </section>
          ) : (
            <section className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
              <section className="student-panel flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="student-eyebrow">{sessionInfo.gameType}</p>
                    <h2 className="student-section-title">{levelData.title}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="student-preview-chip">Retry x{sessionInfo.retryMultiplier}</span>
                    {canAdvanceLevel && <span className="student-preview-chip">Next unlocked</span>}
                  </div>
                </div>

                <div className={`student-game-frame-wrap ${isGameThree ? 'student-game-frame-wrap-scrollable' : ''}`}>
                  <div
                    className={`student-game-frame-shell ${isGameThree ? 'student-game-frame-shell-fluid' : ''}`}
                    style={{
                      width: isGameThree ? '100%' : `${frameSize.width}px`,
                      maxWidth: '100%',
                    }}
                  >
                    {isGameTwo ? (
                      <GameCanvasGameTwo
                        key={sessionInfo.sessionId}
                        levelData={levelData}
                        onLevelComplete={submitOutcome}
                        onLevelFail={submitOutcome}
                        onExitRequest={handleExitRequest}
                        resultData={resultData}
                        gameplayData={gameplayData}
                        isSubmitting={isSubmitting}
                        canAdvanceLevel={canAdvanceLevel}
                        onRetry={handleRetry}
                        onBack={onClose}
                        onNextLevel={handleNextLevel}
                      />
                    ) : isGameThree ? (
                      <GameCanvasGameThree
                        key={sessionInfo.sessionId}
                        levelData={levelData}
                        viewportWidth={viewportSize.width}
                        onLevelComplete={submitOutcome}
                        onExitRequest={handleExitRequest}
                        resultData={resultData}
                        gameplayData={gameplayData}
                        isSubmitting={isSubmitting}
                        canAdvanceLevel={canAdvanceLevel}
                        onRetry={handleRetry}
                        onBack={onClose}
                        onNextLevel={handleNextLevel}
                      />
                    ) : (
                      <GameCanvas
                        key={sessionInfo.sessionId}
                        levelData={levelData}
                        runtimeAssets={gameOneRuntimeAssets}
                        onLevelComplete={submitOutcome}
                        onLevelFail={submitOutcome}
                        onExitRequest={handleExitRequest}
                        resultData={resultData}
                        gameplayData={gameplayData}
                        isSubmitting={isSubmitting}
                        canAdvanceLevel={canAdvanceLevel}
                        onRetry={handleRetry}
                        onBack={onClose}
                        onNextLevel={handleNextLevel}
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left">
                  <p className="student-eyebrow">Objective</p>
                  <p className="student-body-copy student-body-copy-tight mt-1">{levelObjective}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                    {controlsText.map(({ label, Icon }) => (
                      <span key={label} className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </section>
          )}
        </main>
      </StudentShell>
    </motion.div>
  );
};

export default StudentGameOverlay;
