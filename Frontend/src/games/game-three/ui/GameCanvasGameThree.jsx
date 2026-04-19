import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';

const DEFAULT_ACCENTS = ['#34d399', '#38bdf8', '#f59e0b', '#fb7185', '#a78bfa', '#22c55e'];
const DEFAULT_COLUMNS = 4;
const DEFAULT_FLIP_BACK_MS = 900;
const DEFAULT_PREVIEW_MS = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());

const toRgba = (hexColor, alpha) => {
  if (!isHexColor(hexColor)) {
    return `rgba(15, 23, 42, ${alpha})`;
  }

  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const shuffleDeck = (items) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const normalizeQuestion = (question, pairLabel) => {
  const rawOptions = Array.isArray(question?.options) ? question.options : [];
  const options = (rawOptions.length > 0 ? rawOptions : ['A', 'B', 'C', 'D']).map((option, index) => {
    const fallbackId = String.fromCharCode(97 + index);
    const safeId = typeof option === 'object' && option?.id
      ? String(option.id).trim().toLowerCase()
      : fallbackId;
    const safeLabel = typeof option === 'object' && option?.label
      ? String(option.label).trim()
      : String(option || fallbackId).trim();

    return {
      id: safeId || fallbackId,
      label: safeLabel || fallbackId.toUpperCase(),
    };
  });

  const optionIds = new Set(options.map((option) => option.id));
  const rawCorrectOptionId = String(question?.correctOptionId || '').trim().toLowerCase();
  const correctOptionId = optionIds.has(rawCorrectOptionId) ? rawCorrectOptionId : options[0]?.id || 'a';

  return {
    prompt: typeof question?.prompt === 'string' && question.prompt.trim()
      ? question.prompt.trim()
      : `Sample question for ${pairLabel}. Choose the correct option.`,
    options,
    correctOptionId,
  };
};

const normalizePairs = (pairs) => (
  (Array.isArray(pairs) ? pairs : [])
    .map((pair, index) => {
      if (!pair || typeof pair !== 'object') {
        return null;
      }

      const safeId = String(pair.id || '').trim();
      if (!safeId) {
        return null;
      }

      const safeLabel = typeof pair.label === 'string' && pair.label.trim()
        ? pair.label.trim()
        : `Pair ${index + 1}`;
      const accent = isHexColor(pair.accent)
        ? String(pair.accent).trim()
        : DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length];
      const badge = typeof pair.badge === 'string' && pair.badge.trim()
        ? pair.badge.trim()
        : String(index + 1).padStart(2, '0');

      return {
        id: safeId,
        label: safeLabel,
        accent,
        badge,
        question: normalizeQuestion(pair.question, safeLabel),
      };
    })
    .filter(Boolean)
);

const buildDeck = (pairs) => shuffleDeck(
  pairs.flatMap((pair) => [
    {
      cardId: `${pair.id}-1`,
      pairId: pair.id,
      label: pair.label,
      accent: pair.accent,
      badge: pair.badge,
    },
    {
      cardId: `${pair.id}-2`,
      pairId: pair.id,
      label: pair.label,
      accent: pair.accent,
      badge: pair.badge,
    },
  ]),
);

const renderScreenModal = (content) => (
  typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null
);

const GameCanvasGameThree = ({
  levelData,
  viewportWidth = 1280,
  onLevelComplete,
  onExitRequest,
  resultData,
  gameplayData,
  isSubmitting,
  canAdvanceLevel,
  onRetry,
  onBack,
  onNextLevel,
}) => {
  const pairs = useMemo(() => normalizePairs(levelData?.pairs), [levelData]);
  const deck = useMemo(() => buildDeck(pairs), [pairs]);
  const deckById = useMemo(
    () => new Map(deck.map((card) => [card.cardId, card])),
    [deck],
  );
  const pairById = useMemo(
    () => new Map(pairs.map((pair) => [pair.id, pair])),
    [pairs],
  );

  const settings = levelData?.settings && typeof levelData.settings === 'object'
    ? levelData.settings
    : {};
  const columns = clamp(Math.round(Number(settings.columns) || DEFAULT_COLUMNS), 2, 8);
  const flipBackMs = clamp(
    Math.round(Number(settings.flipBackMs) || DEFAULT_FLIP_BACK_MS),
    450,
    2200,
  );
  const previewMs = clamp(
    Math.round(Number(settings.previewMs) || DEFAULT_PREVIEW_MS),
    0,
    8000,
  );

  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [matchedPairIds, setMatchedPairIds] = useState([]);
  const [answeredPairIds, setAnsweredPairIds] = useState([]);
  const [points, setPoints] = useState(0);
  const [moves, setMoves] = useState(0);
  const [mismatches, setMismatches] = useState(0);
  const [isPreviewing, setIsPreviewing] = useState(previewMs > 0);
  const [isResolving, setIsResolving] = useState(false);
  const [activePairId, setActivePairId] = useState('');
  const [questionFeedback, setQuestionFeedback] = useState(null);

  const compareTimerRef = useRef(null);
  const previewTimerRef = useRef(null);
  const submittedRef = useRef(false);

  const selectedCardIdSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);
  const matchedPairIdSet = useMemo(() => new Set(matchedPairIds), [matchedPairIds]);
  const answeredPairIdSet = useMemo(() => new Set(answeredPairIds), [answeredPairIds]);
  const totalPairs = pairs.length;
  const totalCards = deck.length;
  const activePair = activePairId ? pairById.get(activePairId) : null;
  const summaryPoints = gameplayData?.points ?? points;
  const summaryMoves = gameplayData?.moves ?? moves;
  const summaryPairs = gameplayData?.matchedPairs ?? matchedPairIds.length;
  const preferredColumns = Math.min(totalCards, Math.max(2, columns));
  const responsiveColumns = useMemo(() => {
    if (viewportWidth >= 1400) {
      return preferredColumns;
    }

    if (viewportWidth >= 1180) {
      return Math.min(preferredColumns, 7);
    }

    if (viewportWidth >= 920) {
      return Math.min(preferredColumns, 6);
    }

    if (viewportWidth >= 760) {
      return Math.min(preferredColumns, 5);
    }

    if (viewportWidth >= 560) {
      return Math.min(preferredColumns, 4);
    }

    return Math.min(preferredColumns, 3);
  }, [preferredColumns, viewportWidth]);
  const responsiveRows = useMemo(
    () => Math.max(1, Math.ceil(totalCards / responsiveColumns)),
    [responsiveColumns, totalCards],
  );

  useEffect(() => {
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
    }

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    submittedRef.current = false;
    setSelectedCardIds([]);
    setMatchedPairIds([]);
    setAnsweredPairIds([]);
    setPoints(0);
    setMoves(0);
    setMismatches(0);
    setIsResolving(false);
    setActivePairId('');
    setQuestionFeedback(null);
    setIsPreviewing(previewMs > 0);

    if (previewMs > 0) {
      previewTimerRef.current = window.setTimeout(() => {
        setIsPreviewing(false);
      }, previewMs);
    }
  }, [deck, previewMs]);

  useEffect(() => () => {
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
    }

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (submittedRef.current || totalPairs === 0 || answeredPairIds.length < totalPairs) {
      return;
    }

    submittedRef.current = true;
    onLevelComplete?.({
      outcome: 'COMPLETED',
      points,
      answeredQuestions: answeredPairIds.length,
      totalQuestions: totalPairs,
      matchedPairs: matchedPairIds.length,
      totalPairs,
      moves,
      mismatches,
    });
  }, [answeredPairIds.length, matchedPairIds.length, mismatches, moves, onLevelComplete, points, totalPairs]);

  const handleCardSelect = (card) => {
    const interactionLocked = Boolean(
      isSubmitting
      || resultData
      || isPreviewing
      || isResolving
      || activePairId,
    );

    if (interactionLocked) {
      return;
    }

    if (matchedPairIdSet.has(card.pairId) || selectedCardIdSet.has(card.cardId)) {
      return;
    }

    if (selectedCardIds.length === 0) {
      setSelectedCardIds([card.cardId]);
      return;
    }

    const firstCard = deckById.get(selectedCardIds[0]);
    if (!firstCard) {
      setSelectedCardIds([card.cardId]);
      return;
    }

    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
    }

    setSelectedCardIds([firstCard.cardId, card.cardId]);
    setMoves((value) => value + 1);
    setIsResolving(true);

    const isMatch = firstCard.pairId === card.pairId;
    compareTimerRef.current = window.setTimeout(() => {
      if (isMatch) {
        setMatchedPairIds((previous) => (
          previous.includes(card.pairId) ? previous : [...previous, card.pairId]
        ));
        setActivePairId(card.pairId);
        setQuestionFeedback(null);
      } else {
        setMismatches((value) => value + 1);
      }

      setSelectedCardIds([]);
      setIsResolving(false);
    }, isMatch ? 440 : flipBackMs);
  };

  const handleQuestionAnswer = (optionId) => {
    if (!activePair || questionFeedback) {
      return;
    }

    const correctOptionId = activePair.question.correctOptionId;
    const isCorrect = optionId === correctOptionId;

    setQuestionFeedback({
      isCorrect,
      selectedOptionId: optionId,
      correctOptionId,
    });

    setAnsweredPairIds((previous) => (
      previous.includes(activePair.id) ? previous : [...previous, activePair.id]
    ));

    if (isCorrect) {
      setPoints((value) => value + 1);
    }
  };

  const handleContinueFromQuestion = () => {
    if (!questionFeedback) {
      return;
    }

    setActivePairId('');
    setQuestionFeedback(null);
  };

  if (totalPairs === 0) {
    return (
      <div className="game-three-shell">
        <section className="game-three-empty-state">
          <AlertCircle className="h-6 w-6" />
          <div>
            <h3>No Cards Available</h3>
            <p>This level does not have any memory cards yet.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack || onExitRequest}>
            Back
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="game-three-shell">
      <div className="game-three-layout">
        <section className="game-three-board-panel">
          <div className="game-three-board-shell">
            <div className="game-three-board-wrap">
              <div
                className="game-three-board"
                style={{
                  '--game-three-columns': String(responsiveColumns),
                  '--game-three-rows': String(responsiveRows),
                }}
              >
                {deck.map((card) => {
                  const isFaceUp = isPreviewing
                    || matchedPairIdSet.has(card.pairId)
                    || selectedCardIdSet.has(card.cardId);
                  const isMatched = matchedPairIdSet.has(card.pairId);
                  const isAnswered = answeredPairIdSet.has(card.pairId);
                  const accentGlow = toRgba(card.accent, isMatched ? 0.28 : 0.22);

                  return (
                    <motion.button
                      key={card.cardId}
                      type="button"
                      className={clsx(
                        'game-three-card',
                        isFaceUp && 'game-three-card-flipped',
                        isMatched && 'game-three-card-matched',
                        (isPreviewing || isResolving || activePairId || isSubmitting || resultData) && 'game-three-card-disabled',
                      )}
                      onClick={() => handleCardSelect(card)}
                      whileHover={isFaceUp || isSubmitting || resultData ? undefined : { y: -4, scale: 1.02 }}
                      whileTap={isFaceUp || isSubmitting || resultData ? undefined : { scale: 0.98 }}
                      aria-label={`Memory card ${card.label}`}
                    >
                      <div className="game-three-card-inner">
                        <div className="game-three-card-face game-three-card-back">
                          <span className="game-three-card-badge">{card.badge}</span>
                          <span className="game-three-card-mark">?</span>
                          <span className="game-three-card-caption">Flip</span>
                        </div>

                        <div
                          className="game-three-card-face game-three-card-front"
                          style={{
                            background: `linear-gradient(165deg, ${toRgba(card.accent, 0.95)} 0%, #0f172a 145%)`,
                            boxShadow: `0 20px 30px ${accentGlow}`,
                          }}
                        >
                          <span className="game-three-card-badge">{card.badge}</span>
                          <div className="game-three-card-copy">
                            <span className="game-three-card-title">{card.label}</span>
                            <span className="game-three-card-caption">
                              {isAnswered ? 'Question answered' : 'Pair matched'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="game-three-board-footer">
            <span className="game-three-board-note">
              Flip two cards at a time. Matching pairs unlock a quiz card.
            </span>
            <span className="game-three-board-note">
              Wrong quiz answers do not subtract points.
            </span>
          </div>
        </section>

        <aside className="game-three-side-panel">
          <div className="game-three-side-card">
            <p className="student-mini-kicker">Progress</p>
            <div className="game-three-side-metrics">
              <span className="game-three-metric">
                <Sparkles className="h-4 w-4" />
                Pairs {matchedPairIds.length}/{totalPairs}
              </span>
              <span className="game-three-metric">
                <Trophy className="h-4 w-4" />
                Points {points}
              </span>
              <span className="game-three-metric">
                <Eye className="h-4 w-4" />
                Questions {answeredPairIds.length}/{totalPairs}
              </span>
            </div>
          </div>

          <div className="game-three-side-card">
            <p className="student-mini-kicker">Run State</p>
            <div className="game-three-side-status">
              {isPreviewing ? (
                <span className="game-three-status game-three-status-preview">
                  Memorize the board
                </span>
              ) : isResolving ? (
                <span className="game-three-status game-three-status-live">
                  Checking cards...
                </span>
              ) : (
                <span className="game-three-status game-three-status-neutral">
                  Find the next pair
                </span>
              )}
              <span className="game-three-side-copy">
                <Target className="h-4 w-4" />
                {`Moves ${moves} | Misses ${mismatches}`}
              </span>
            </div>
          </div>

          <div className="game-three-side-card">
            <p className="student-mini-kicker">Session</p>
            <div className="game-three-side-copy-stack">
              <span className="game-three-side-copy">Square board scales with the level size.</span>
              <span className="game-three-side-copy">Each matched pair opens one scoring question.</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onExitRequest}>
              Exit Level
            </button>
          </div>
        </aside>
      </div>

      {renderScreenModal(
        <AnimatePresence>
          {activePair && (
            <motion.div
              className="game-three-question-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="game-three-question-card"
                initial={{ opacity: 0, scale: 0.78, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 10 }}
                transition={{ duration: 0.22 }}
              >
                <div className="game-three-question-head">
                  <motion.div
                    className="game-three-question-pair"
                    initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.24, delay: 0.05 }}
                    style={{
                      background: `linear-gradient(160deg, ${toRgba(activePair.accent, 0.96)} 0%, #0f172a 145%)`,
                      boxShadow: `0 18px 30px ${toRgba(activePair.accent, 0.22)}`,
                    }}
                  >
                    <span className="game-three-card-badge">{activePair.badge}</span>
                    <span className="game-three-question-pair-title">{activePair.label}</span>
                  </motion.div>

                  <div className="game-three-question-copy">
                    <p className="student-mini-kicker">Pair matched</p>
                    <h3>Answer to earn 1 point</h3>
                    <p>{activePair.question.prompt}</p>
                  </div>
                </div>

                <div className="game-three-option-grid">
                  {activePair.question.options.map((option) => {
                    const isSelected = questionFeedback?.selectedOptionId === option.id;
                    const isCorrect = questionFeedback?.correctOptionId === option.id;
                    const isWrongSelected = Boolean(
                      questionFeedback
                      && isSelected
                      && !questionFeedback.isCorrect,
                    );

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={clsx(
                          'game-three-option',
                          isSelected && 'game-three-option-selected',
                          isCorrect && questionFeedback && 'game-three-option-correct',
                          isWrongSelected && 'game-three-option-wrong',
                        )}
                        onClick={() => handleQuestionAnswer(option.id)}
                        disabled={Boolean(questionFeedback)}
                      >
                        <span className="game-three-option-index">{option.id.toUpperCase()}</span>
                        <span className="game-three-option-label">{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="game-three-question-footer">
                  {questionFeedback ? (
                    <p
                      className={clsx(
                        'game-three-question-feedback',
                        questionFeedback.isCorrect
                          ? 'game-three-question-feedback-correct'
                          : 'game-three-question-feedback-wrong',
                      )}
                    >
                      {questionFeedback.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Correct. You earned 1 point.
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          No point this round. Correct answer:{' '}
                          {activePair.question.options.find(
                            (option) => option.id === questionFeedback.correctOptionId,
                          )?.label || questionFeedback.correctOptionId.toUpperCase()}
                          .
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="game-three-question-hint">
                      Choose one option to continue the run.
                    </p>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleContinueFromQuestion}
                    disabled={!questionFeedback}
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
      )}

      {renderScreenModal(
        (isSubmitting || resultData) && (
          <div className="game-three-result-overlay">
            {isSubmitting ? (
              <div className="game-three-result-card">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
                <p className="text-lg font-black text-slate-900">Submitting Result...</p>
              </div>
            ) : (
              <div className="game-three-result-card">
                <div className="game-three-result-title">
                  {resultData?.result === 'COMPLETED' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-700" />
                  )}
                  <span>{resultData?.result === 'COMPLETED' ? 'Quiz Run Complete' : 'Run Ended'}</span>
                </div>

                <div className="game-three-result-stats">
                  <span>Final points: <strong>{summaryPoints}</strong> / {totalPairs}</span>
                  <span>Pairs solved: <strong>{summaryPairs}</strong> / {totalPairs}</span>
                  <span>Moves used: <strong>{summaryMoves}</strong></span>
                  <span>Stars earned: <strong>{resultData?.starsEarned ?? 0}</strong></span>
                </div>

                <div className="game-three-result-actions">
                  <button type="button" className="btn btn-secondary" onClick={onRetry}>
                    <RotateCcw className="h-4 w-4" />
                    Retry
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={onBack}>
                    Back
                  </button>
                  {canAdvanceLevel && (
                    <button type="button" className="btn btn-primary" onClick={onNextLevel}>
                      Next Level
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
};

export default GameCanvasGameThree;
