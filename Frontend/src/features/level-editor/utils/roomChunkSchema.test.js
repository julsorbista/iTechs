import { describe, expect, it } from 'vitest';

import { normalizeRoomChunkData } from './roomChunkSchema';

describe('roomChunkSchema portal normalization', () => {
  it('normalizes level settings with defaults', () => {
    const normalized = normalizeRoomChunkData({
      settings: {
        playerHealth: 12,
        timerEnabled: true,
        timerSeconds: 5,
      },
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
        },
      ],
    });

    expect(normalized.settings).toEqual({
      backgroundKey: 'tutorialGrove',
      playerHealth: 10,
      timerEnabled: true,
      timerSeconds: 10,
    });
  });

  it('keeps valid portal targets and normalizes endings', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          portal: {
            targetRoomId: 'room-b',
            endsLevel: true,
          },
        },
        {
          id: 'room-b',
          row: 0,
          col: 1,
          links: [],
        },
      ],
    });

    expect(normalized.rooms[0].portal).toEqual({
      targetRoomId: 'room-b',
      endsLevel: false,
    });
  });

  it('clears invalid portal targets and defaults to level-ending portal', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          portal: {
            targetRoomId: 'room-missing',
            endsLevel: false,
          },
        },
      ],
    });

    expect(normalized.rooms[0].portal).toEqual({
      targetRoomId: null,
      endsLevel: true,
    });
  });

  it('keeps at most two portal components for a shared link name', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          components: [
            { id: 'p-1', type: 'portal', x: 120, y: 500, linkName: 'alpha' },
            { id: 'p-2', type: 'portal', x: 220, y: 500, linkName: 'alpha' },
            { id: 'p-3', type: 'portal', x: 320, y: 500, linkName: 'alpha' },
          ],
        },
      ],
    });

    const portals = normalized.rooms[0].components.filter((component) => component.type === 'portal');
    expect(portals).toHaveLength(3);
    expect(portals.map((component) => component.linkName)).toEqual(['alpha', 'alpha', '']);
  });

  it('caps shared portal names across different rooms', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          components: [
            { id: 'p-a1', type: 'portal', x: 100, y: 520, linkName: 'bridge' },
          ],
        },
        {
          id: 'room-b',
          row: 0,
          col: 1,
          links: [],
          components: [
            { id: 'p-b1', type: 'portal', x: 180, y: 520, linkName: 'bridge' },
          ],
        },
        {
          id: 'room-c',
          row: 0,
          col: 2,
          links: [],
          components: [
            { id: 'p-c1', type: 'portal', x: 260, y: 520, linkName: 'bridge' },
          ],
        },
      ],
    });

    const portals = normalized.rooms.flatMap((room) => room.components.filter((component) => component.type === 'portal'));
    expect(portals.map((component) => component.linkName)).toEqual(['bridge', 'bridge', '']);
  });

  it('normalizes invisiblePlatform and statue components', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          components: [
            {
              id: 'invis-1',
              type: 'invisiblePlatform',
              x: 120,
              y: 480,
              width: 360,
              height: 42,
              passThroughSides: ['left', 'TOP', 'invalid'],
            },
            {
              id: 'statue-1',
              type: 'statue',
              x: 640,
              y: 520,
              questionTopic: '  Binary search basics  ',
              aiChoicesCount: 6,
              aiDifficulty: 'HARD',
              aiLanguage: '  Filipino  ',
              aiGradeLevel: '  Grade 8  ',
              aiInstructions: '  Keep it practical and use simple words.  ',
              prompt: '  What is 2 + 2? ',
              choices: ['3', '4', '5'],
              correctAnswerIndex: 1,
            },
          ],
        },
      ],
    });

    const invisible = normalized.rooms[0].components.find((component) => component.type === 'invisiblePlatform');
    const statue = normalized.rooms[0].components.find((component) => component.type === 'statue');

    expect(invisible).toMatchObject({
      width: 360,
      height: 42,
      passThroughSides: ['LEFT', 'TOP'],
    });

    expect(statue).toMatchObject({
      questionTopic: '  Binary search basics  ',
      aiChoicesCount: 6,
      aiDifficulty: 'hard',
      aiLanguage: 'Filipino',
      aiGradeLevel: 'Grade 8',
      aiInstructions: 'Keep it practical and use simple words.',
      prompt: 'What is 2 + 2?',
      choices: ['3', '4', '5'],
      correctAnswerIndex: 1,
    });
  });

  it('normalizes room background tiles for map editing', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          components: [],
          backgroundTiles: [
            {
              id: 'tile-1',
              tileKey: 'tile-portal-portal-1',
              x: 144,
              y: 288,
              size: 120,
            },
            {
              id: 'tile-2',
              tileKey: ' ',
              x: -50,
              y: 900,
              size: 9,
            },
          ],
        },
      ],
    });

    expect(normalized.rooms[0].backgroundTiles).toEqual([
      {
        id: 'tile-1',
        tileKey: 'tile-portal-portal-1',
        x: 144,
        y: 288,
        size: 120,
        zIndex: 0,
        rotationDeg: 0,
        flipX: false,
        flipY: false,
      },
    ]);
  });

  it('normalizes room background color for tile editing', () => {
    const normalized = normalizeRoomChunkData({
      rooms: [
        {
          id: 'room-a',
          row: 0,
          col: 0,
          links: [],
          components: [],
          backgroundColor: '#F97316',
        },
      ],
    });

    expect(normalized.rooms[0].backgroundColor).toBe('#f97316');
  });
});
