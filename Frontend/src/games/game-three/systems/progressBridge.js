const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const buildSubmissionPayload = (gameplay, sessionInfo = {}) => {
  const safePoints = clamp(Math.round(Number(gameplay?.points || 0)), 0, 9999);
  const safeAnsweredQuestions = clamp(Math.round(Number(gameplay?.answeredQuestions || 0)), 0, 9999);
  const safeTotalQuestions = Math.max(
    safeAnsweredQuestions,
    clamp(Math.round(Number(gameplay?.totalQuestions || 0)), 0, 9999),
  );
  const safeRetryMultiplier = clamp(Number(sessionInfo?.retryMultiplier || 1), 0.5, 1);
  const completed = gameplay?.outcome === 'COMPLETED'
    || (safeTotalQuestions > 0 && safeAnsweredQuestions >= safeTotalQuestions);

  return {
    outcome: completed ? 'COMPLETED' : 'FAILED',
    mistakes: 0,
    hintsUsed: 0,
    baseScore: completed ? Math.max(0, Math.round(safePoints / safeRetryMultiplier)) : 0,
  };
};

export default buildSubmissionPayload;
