import { describe, expect, it } from 'vitest';
import {
  applyCorrectDrop,
  createInitialPlacementMap,
  getPlacedCount,
  isCorrectDrop,
  isLevelCompleted,
} from './gameTwoValidation';

describe('gameTwoValidation helpers', () => {
  it('creates an empty placement map from slots', () => {
    const slots = [{ id: 'cpu-slot' }, { id: 'ram-slot' }];
    expect(createInitialPlacementMap(slots)).toEqual({
      'cpu-slot': null,
      'ram-slot': null,
    });
  });

  it('evaluates correct and wrong drops', () => {
    const slot = { id: 'gpu-slot', accepts: 'gpu' };
    expect(isCorrectDrop(slot, 'gpu')).toBe(true);
    expect(isCorrectDrop(slot, 'cpu')).toBe(false);
  });

  it('marks level completed only when all slots are correctly filled', () => {
    const slots = [
      { id: 'cpu-slot', accepts: 'cpu' },
      { id: 'ram-slot', accepts: 'ram' },
    ];

    let placements = createInitialPlacementMap(slots);
    placements = applyCorrectDrop(placements, 'cpu-slot', 'cpu');

    expect(getPlacedCount(placements)).toBe(1);
    expect(isLevelCompleted(placements, slots)).toBe(false);

    placements = applyCorrectDrop(placements, 'ram-slot', 'ram');
    expect(getPlacedCount(placements)).toBe(2);
    expect(isLevelCompleted(placements, slots)).toBe(true);
  });
});
