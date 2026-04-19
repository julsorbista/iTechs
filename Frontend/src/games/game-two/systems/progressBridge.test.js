import { describe, expect, it } from 'vitest';
import { buildSubmissionPayload } from './progressBridge';

describe('gameTwo progress bridge', () => {
  it('builds a completed payload with computed base score', () => {
    const payload = buildSubmissionPayload({
      outcome: 'COMPLETED',
      mistakes: 2,
      correctPlacements: 3,
      totalPlacements: 3,
    });

    expect(payload).toEqual({
      outcome: 'COMPLETED',
      mistakes: 2,
      hintsUsed: 0,
      baseScore: 430,
    });
  });

  it('builds a failed payload with minimum mistakes for retry penalty logic', () => {
    const payload = buildSubmissionPayload({
      outcome: 'FAILED',
      mistakes: 1,
      correctPlacements: 1,
      totalPlacements: 3,
    });

    expect(payload).toEqual({
      outcome: 'FAILED',
      mistakes: 7,
      hintsUsed: 0,
      baseScore: 0,
    });
  });
});
