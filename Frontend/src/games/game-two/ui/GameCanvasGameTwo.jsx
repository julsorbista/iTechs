import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Grip,
  Info,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { getGameTwoSprite } from '../systems/com1Slices';
import {
  applyCorrectDrop,
  createInitialPlacementMap,
  getPlacedCount,
  isCorrectDrop,
  isLevelCompleted,
} from '../systems/gameTwoValidation';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const GameCanvasGameTwo = ({
  levelData,
  onLevelComplete,
  onExitRequest,
  resultData,
  isSubmitting,
  canAdvanceLevel,
  onRetry,
  onBack,
  onNextLevel,
}) => {
  const slots = useMemo(() => (Array.isArray(levelData?.slots) ? levelData.slots : []), [levelData]);
  const parts = useMemo(() => (Array.isArray(levelData?.parts) ? levelData.parts : []), [levelData]);

  const initialPlacements = useMemo(() => createInitialPlacementMap(slots), [slots]);

  const [placements, setPlacements] = useState(initialPlacements);
  const [mistakes, setMistakes] = useState(0);
  const [draggingPartId, setDraggingPartId] = useState(null);
  const [shakePartId, setShakePartId] = useState('');
  const [shakeSlotId, setShakeSlotId] = useState('');
  const [infoCard, setInfoCard] = useState(null);
  const [activeQuestionPartId, setActiveQuestionPartId] = useState('');
  const [questionFeedback, setQuestionFeedback] = useState(null);
  const [answeredQuestionMap, setAnsweredQuestionMap] = useState({});
  const [points, setPoints] = useState(0);

  const infoTimerRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    setPlacements(initialPlacements);
    setMistakes(0);
    setDraggingPartId(null);
    setShakePartId('');
    setShakeSlotId('');
    setInfoCard(null);
    setActiveQuestionPartId('');
    setQuestionFeedback(null);
    setAnsweredQuestionMap({});
    setPoints(0);
    submittedRef.current = false;
  }, [initialPlacements]);

  useEffect(() => () => {
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
    }
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
    }
  }, []);

  const partMap = useMemo(
    () => new Map(parts.map((part) => [part.id, part])),
    [parts],
  );
  const spriteMap = useMemo(
    () => new Map(parts.map((part) => [part.id, getGameTwoSprite(part.sliceKey)])),
    [parts],
  );

  const board = levelData?.board || {};
  const boardWidth = Number(board.renderWidth) || 560;
  const boardHeight = Number(board.renderHeight) || 560;
  const boardSprite = getGameTwoSprite(board.sliceKey || 'motherboard');

  const placedPartIds = useMemo(
    () => new Set(Object.values(placements).filter(Boolean)),
    [placements],
  );

  const availableParts = useMemo(
    () => parts.filter((part) => !placedPartIds.has(part.id)),
    [parts, placedPartIds],
  );
  const activeQuestionPart = activeQuestionPartId ? partMap.get(activeQuestionPartId) : null;
  const questionParts = useMemo(
    () => parts.filter((part) => Array.isArray(part?.question?.options) && part.question.options.length > 0),
    [parts],
  );

  const placedCount = getPlacedCount(placements);
  const totalSlots = slots.length;
  const totalQuestions = questionParts.length;
  const answeredQuestionsCount = Object.keys(answeredQuestionMap).length;

  const showInfo = (part) => {
    if (!part) {
      return;
    }

    setInfoCard({
      title: part.label,
      description: part.info,
    });

    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
    }

    infoTimerRef.current = setTimeout(() => {
      setInfoCard(null);
    }, 2600);
  };

  const showWrongFeedback = (partId, slotId) => {
    setMistakes((value) => value + 1);
    setShakePartId(partId);
    setShakeSlotId(slotId);

    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
    }

    shakeTimerRef.current = setTimeout(() => {
      setShakePartId('');
      setShakeSlotId('');
    }, 380);
  };

  const resolvePartIdFromDrop = (event) => {
    const fromTransfer = event?.dataTransfer?.getData('application/x-itechs-part-id');
    if (fromTransfer) {
      return fromTransfer;
    }

    return draggingPartId || '';
  };

  const handleDropOnSlot = (event, slot) => {
    event.preventDefault();

    const partId = resolvePartIdFromDrop(event);
    if (!partId || placements[slot.id]) {
      return;
    }

    const part = partMap.get(partId);
    if (!part) {
      return;
    }

    if (!isCorrectDrop(slot, partId)) {
      showWrongFeedback(partId, slot.id);
      return;
    }

    setPlacements((previous) => applyCorrectDrop(previous, slot.id, partId));

    if (part.question?.correctOptionId && Array.isArray(part.question?.options)) {
      setInfoCard(null);
      setActiveQuestionPartId(part.id);
      setQuestionFeedback(null);
      return;
    }

    showInfo(part);
  };

  const handleQuestionAnswer = (optionId) => {
    if (!activeQuestionPart || questionFeedback) {
      return;
    }

    const correctOptionId = activeQuestionPart.question?.correctOptionId;
    const isCorrect = optionId === correctOptionId;

    setQuestionFeedback({
      selectedOptionId: optionId,
      correctOptionId,
      isCorrect,
    });

    setAnsweredQuestionMap((current) => (
      current[activeQuestionPart.id]
        ? current
        : { ...current, [activeQuestionPart.id]: true }
    ));

    if (isCorrect) {
      setPoints((current) => current + 1);
    }
  };

  const handleContinueFromQuestion = () => {
    if (!activeQuestionPart) {
      return;
    }

    showInfo(activeQuestionPart);
    setActiveQuestionPartId('');
    setQuestionFeedback(null);
  };

  useEffect(() => {
    if (submittedRef.current) {
      return;
    }

    const allQuestionsResolved = totalQuestions === 0 || answeredQuestionsCount >= totalQuestions;

    if (!isLevelCompleted(placements, slots)) {
      return;
    }

    if (!allQuestionsResolved || activeQuestionPartId) {
      return;
    }

    submittedRef.current = true;

    onLevelComplete?.({
      outcome: 'COMPLETED',
      mistakes,
      correctPlacements: slots.length,
      totalPlacements: slots.length,
      points,
      answeredQuestions: answeredQuestionsCount,
      totalQuestions,
    });
  }, [activeQuestionPartId, answeredQuestionsCount, mistakes, onLevelComplete, placements, points, slots, totalQuestions]);

  return (
    <div className="game-two-shell">
      <div className="game-two-layout">
        <section className="game-two-board-wrap">
          <div className="game-two-board" style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
            <div className="game-two-board-image">
              {boardSprite && (
                <img
                  src={boardSprite.url}
                  alt={levelData?.title || 'Motherboard'}
                  className="game-two-board-image-sprite"
                  draggable={false}
                />
              )}
            </div>

            {slots.map((slot) => {
              const slotWidth = clamp(Number(slot.width) || 12, 8, 80);
              const slotHeight = clamp(Number(slot.height) || 12, 8, 80);
              const slotX = clamp(Number(slot.x) || 0, 0, 100);
              const slotY = clamp(Number(slot.y) || 0, 0, 100);
              const placedPartId = placements[slot.id];
              const placedPart = placedPartId ? partMap.get(placedPartId) : null;
              const placedSprite = placedPartId ? spriteMap.get(placedPartId) : null;
              const placedRotation = Number(slot.rotation ?? placedPart?.placedRotation ?? 0) || 0;

              return (
                <div
                  key={slot.id}
                  className={`game-two-slot ${placedPart ? 'game-two-slot-locked' : ''} ${shakeSlotId === slot.id ? 'game-two-shake' : ''}`}
                  style={{
                    left: `${slotX}%`,
                    top: `${slotY}%`,
                    width: `${slotWidth}%`,
                    height: `${slotHeight}%`,
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropOnSlot(event, slot)}
                >
                  {placedPart ? (
                    <div className="game-two-part-in-slot">
                      {placedSprite && (
                        <img
                          src={placedSprite.url}
                          alt={placedPart.label}
                          className="game-two-part-in-slot-image"
                          style={placedRotation ? { transform: `rotate(${placedRotation}deg)` } : undefined}
                          draggable={false}
                        />
                      )}
                    </div>
                  ) : (
                    <span className="game-two-slot-label">{slot.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="game-two-metrics">
            <span className="student-stat-chip">Placed {placedCount}/{totalSlots}</span>
            <span className="student-stat-chip">Mistakes {mistakes}</span>
            <span className="student-stat-chip">Points {points}/{totalQuestions}</span>
            <button type="button" className="student-stat-chip" onClick={onExitRequest}>
              Exit Level
            </button>
          </div>
        </section>

        <aside className="game-two-parts-wrap">
          <div className="game-two-parts-head">
            <p className="student-mini-kicker">Disassembled Parts</p>
            <h3>Drag To Matching Slot</h3>
          </div>

          <div className="game-two-parts-grid">
            {availableParts.map((part) => {
              const partSprite = spriteMap.get(part.id);

              return (
                <div
                  key={part.id}
                  draggable
                  className={`game-two-part-card ${draggingPartId === part.id ? 'game-two-part-dragging' : ''} ${shakePartId === part.id ? 'game-two-shake' : ''}`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-itechs-part-id', part.id);
                    event.dataTransfer.effectAllowed = 'move';

                    const previewImage = event.currentTarget.querySelector('.game-two-part-preview-image');
                    if (previewImage && event.dataTransfer?.setDragImage) {
                      event.dataTransfer.setDragImage(
                        previewImage,
                        previewImage.clientWidth / 2,
                        previewImage.clientHeight / 2,
                      );
                    }

                    setDraggingPartId(part.id);
                  }}
                  onDragEnd={() => setDraggingPartId('')}
                >
                  <div className="game-two-part-meta">
                    <Grip className="h-3.5 w-3.5" />
                    <span>{part.label}</span>
                  </div>
                  <div className="game-two-part-preview">
                    {partSprite && (
                      <img
                        src={partSprite.url}
                        alt={part.label}
                        className="game-two-part-preview-image"
                        draggable={false}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {availableParts.length === 0 && (
              <div className="game-two-empty-state">
                <CheckCircle2 className="h-5 w-5" />
                <p>All required parts are locked in place.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {infoCard && (
          <motion.div
            key={infoCard.title}
            className="game-two-info-card"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
          >
            <div className="game-two-info-title">
              <Info className="h-4 w-4" />
              {infoCard.title} Locked
            </div>
            <p>{infoCard.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeQuestionPart && (
          <motion.div
            className="game-two-question-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="game-two-question-card"
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="game-two-question-head">
                <div className="game-two-question-copy">
                  <p className="student-mini-kicker">Component Locked</p>
                  <h3>{activeQuestionPart.label}</h3>
                  <p>{activeQuestionPart.info}</p>
                </div>
                <div className="game-two-question-points">
                  <span>Question Reward</span>
                  <strong>+1 Point</strong>
                </div>
              </div>

              <div className="game-two-question-prompt">
                {activeQuestionPart.question?.prompt}
              </div>

              <div className="game-two-question-options">
                {activeQuestionPart.question?.options?.map((option) => {
                  const isSelected = questionFeedback?.selectedOptionId === option.id;
                  const isCorrect = questionFeedback?.correctOptionId === option.id;
                  const isWrongSelected = Boolean(questionFeedback && isSelected && !questionFeedback.isCorrect);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`game-two-question-option ${isSelected ? 'game-two-question-option-selected' : ''} ${isCorrect && questionFeedback ? 'game-two-question-option-correct' : ''} ${isWrongSelected ? 'game-two-question-option-wrong' : ''}`}
                      onClick={() => handleQuestionAnswer(option.id)}
                      disabled={Boolean(questionFeedback)}
                    >
                      <span className="game-two-question-option-index">{option.id.toUpperCase()}</span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="game-two-question-footer">
                {questionFeedback ? (
                  <p className={`game-two-question-feedback ${questionFeedback.isCorrect ? 'game-two-question-feedback-correct' : 'game-two-question-feedback-wrong'}`}>
                    {questionFeedback.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Correct. You earned 1 point.
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        No point awarded. Correct answer:{' '}
                        {activeQuestionPart.question?.options?.find((option) => option.id === questionFeedback.correctOptionId)?.label || questionFeedback.correctOptionId}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="game-two-question-hint">Answer to keep building your point total.</p>
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
      </AnimatePresence>

      {(isSubmitting || resultData) && (
        <div className="game-two-result-overlay">
          {isSubmitting ? (
            <div className="game-two-result-card">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
              <p className="text-lg font-black text-slate-900">Submitting Result...</p>
            </div>
          ) : (
            <div className="game-two-result-card">
              <div className="game-two-result-title">
                {resultData?.result === 'COMPLETED' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-700" />
                )}
                <span>{resultData?.result === 'COMPLETED' ? 'Level Cleared' : 'Try Again'}</span>
              </div>

              <div className="game-two-result-stats">
                <span>Final points: <strong>{points}</strong> / {totalQuestions}</span>
                <span>Placed parts: <strong>{placedCount}</strong> / {totalSlots}</span>
                <span>Stars earned: <strong>{resultData?.starsEarned ?? 0}</strong></span>
              </div>

              <div className="game-two-result-actions">
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
      )}
    </div>
  );
};

export default GameCanvasGameTwo;
