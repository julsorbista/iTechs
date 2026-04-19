const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const buildSubmissionPayload = (gameplay) => {
  const safeMistakes = clamp(Number(gameplay?.mistakes || 0), 0, 9999);
  const safeCorrectPlacements = clamp(Number(gameplay?.correctPlacements || 0), 0, 9999);
  const safePoints = clamp(Number(gameplay?.points || 0), 0, 9999);
  const safeTotalPlacements = Math.max(
    safeCorrectPlacements,
    clamp(Number(gameplay?.totalPlacements || 0), 0, 9999),
  );

  const completed = gameplay?.outcome === 'COMPLETED'
    || (safeTotalPlacements > 0 && safeCorrectPlacements >= safeTotalPlacements);

  const baseScore = completed
    ? Math.max(100, 100 + (safeCorrectPlacements * 120) + (safePoints * 160) - (safeMistakes * 15))
    : 0;

  return {
    outcome: completed ? 'COMPLETED' : 'FAILED',
    mistakes: completed ? safeMistakes : Math.max(6, safeMistakes + 6),
    hintsUsed: 0,
    baseScore,
  };
};
