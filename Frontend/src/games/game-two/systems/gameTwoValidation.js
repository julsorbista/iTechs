export const createInitialPlacementMap = (slots) => (
  (Array.isArray(slots) ? slots : []).reduce((accumulator, slot) => {
    accumulator[slot.id] = null;
    return accumulator;
  }, {})
);

export const isCorrectDrop = (slot, partId) => {
  if (!slot || typeof slot.accepts !== 'string') {
    return false;
  }

  return slot.accepts === partId;
};

export const applyCorrectDrop = (placements, slotId, partId) => ({
  ...placements,
  [slotId]: partId,
});

export const getPlacedCount = (placements) => (
  Object.values(placements || {}).filter(Boolean).length
);

export const isLevelCompleted = (placements, slots) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return false;
  }

  return slots.every((slot) => placements?.[slot.id] === slot.accepts);
};
