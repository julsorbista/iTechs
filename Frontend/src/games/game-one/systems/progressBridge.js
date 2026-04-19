export const buildSubmissionPayload = (outcome) => {
  const safeCoins = Number(outcome?.coinsCollected || 0);
  const safeWrongAnswers = Number(outcome?.wrongAnswers || 0);
  const safeStatuesAnswered = Number(outcome?.statuesAnswered || 0);
  const safeShotsHit = Number(outcome?.shotsHit || 0);
  const safeShotsFired = Number(outcome?.shotsFired || 0);
  const completed = outcome?.outcome === 'COMPLETED';
  const precisionBonus = completed && safeWrongAnswers === 0 ? 120 : 0;
  const statueBonus = completed ? (safeStatuesAnswered * 35) : 0;
  const combatBonus = completed ? Math.min(180, safeShotsHit * 16) : 0;
  const accuracyBonus = completed && safeShotsFired > 0
    ? Math.round(((safeShotsHit / safeShotsFired) * 60))
    : 0;
  const missionBonus = completed && outcome?.missionStage === 'ESCAPE' ? 100 : 0;
  const baseScore = completed
    ? Math.max(100, 100 + (safeCoins * 20) + precisionBonus + statueBonus + combatBonus + accuracyBonus + missionBonus)
    : 0;

  return {
    outcome: completed ? 'COMPLETED' : 'FAILED',
    mistakes: completed ? safeWrongAnswers : Math.max(6, safeWrongAnswers + 6),
    hintsUsed: 0,
    baseScore,
  };
};

export const getResultHeadline = (result) => {
  if (!result) {
    return 'Adventure Ready';
  }

  return result.result === 'COMPLETED'
    ? 'Level Cleared'
    : 'Level Failed';
};
