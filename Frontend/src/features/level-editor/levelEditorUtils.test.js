import { describe, expect, it } from 'vitest';

import { LEVEL_EDITOR_SOURCES } from './levelEditorConfig';
import { cleanLevelData, normalizeLevelData } from './levelEditorUtils';

describe('level editor world normalization', () => {
  it('migrates legacy room-based content into the v2 world-grid shape', () => {
    const source = LEVEL_EDITOR_SOURCES.GAME_ONE;

    const normalized = cleanLevelData(normalizeLevelData({
      gameType: 'GAME_ONE',
      levelNumber: 2,
      viewport: { width: 1280, height: 720 },
      questions: [{ id: 'q-1' }],
      rooms: [
        {
          id: 'room-1',
          layout: { col: 0, row: 0 },
          backgroundKey: 'tutorialGrove',
          objective: 'Start here',
          postUnlockObjective: '',
          spawn: { x: 100, y: 200 },
          platforms: [{ id: 'floor', x: 640, y: 684, width: 1280, bodyHeight: 72, textureKey: 'grass' }],
          coins: [{ id: 'coin-1', x: 200, y: 300 }],
        },
        {
          id: 'room-2',
          layout: { col: 1, row: 0 },
          backgroundKey: 'swampTrail',
          objective: 'Finish here',
          postUnlockObjective: '',
          portal: { x: 1100, y: 560, locked: false, targetRoomId: 'room-3', endsLevel: false },
          platforms: [],
        },
      ],
    }, source));

    expect(normalized.version).toBe(2);
    expect(normalized.grid.cells).toHaveLength(2);
    expect(normalized.worldObjects.spawn).toEqual({ x: 100, y: 200 });
    expect(normalized.worldObjects.coins[0]).toMatchObject({ x: 200, y: 300 });
    expect(Array.isArray(normalized.worldObjects.portal)).toBe(true);
    expect(normalized.worldObjects.portal).toHaveLength(1);
    expect(normalized.worldObjects.portal[0]).toMatchObject({ x: 2380, y: 560, endsLevel: true });
    expect(normalized.worldObjects.portal[0].targetRoomId).toBeUndefined();
  });

  it('keeps runtime background tile metadata and normalizes cell background color', () => {
    const source = LEVEL_EDITOR_SOURCES.GAME_ONE;

    const normalized = cleanLevelData(normalizeLevelData({
      version: 2,
      gameType: 'GAME_ONE',
      levelNumber: 3,
      viewport: { width: 1280, height: 720 },
      questions: [],
      grid: {
        cells: [
          {
            id: 'cell-1',
            col: 0,
            row: 0,
            backgroundKey: 'none',
            backgroundColor: '#F97316',
            objective: '',
            postUnlockObjective: '',
          },
        ],
      },
      worldObjects: {
        spawn: { x: 160, y: 560 },
        platforms: [],
        unlockPlatforms: [],
        barriers: [],
        coins: [],
        ghosts: [],
        projectileEnemies: [],
        villain: [],
        portal: [],
        backgroundTiles: [
          {
            id: 'tile-1',
            tileKey: 'tile-general-1',
            textureKey: 'room-bg-room-1-tile-1',
            imageUrl: 'https://example.com/tile.png',
            x: 200,
            y: 300,
            size: 88,
          },
        ],
      },
    }, source));

    expect(normalized.grid.cells[0].backgroundColor).toBe('#f97316');
    expect(normalized.worldObjects.backgroundTiles).toEqual([
      {
        id: 'tile-1',
        tileKey: 'tile-general-1',
        textureKey: 'room-bg-room-1-tile-1',
        imageUrl: 'https://example.com/tile.png',
        x: 200,
        y: 300,
        size: 88,
        zIndex: 0,
        rotationDeg: 0,
        flipX: false,
        flipY: false,
        blendMode: 'normal',
      },
    ]);
  });
});
