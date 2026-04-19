import { describe, expect, it } from 'vitest';

import { WORLD_OBJECT_DEFINITIONS, LEVEL_EDITOR_SOURCES } from './levelEditorConfig';
import {
  getCellValidationMessages,
  getLevelValidationMessages,
  getObjectValidationMessages,
  groupFieldDefinitions,
} from './levelEditorPresentation';

const source = LEVEL_EDITOR_SOURCES.GAME_ONE;

describe('level editor presentation helpers', () => {
  it('groups fields by their configured section label', () => {
    const groups = groupFieldDefinitions(WORLD_OBJECT_DEFINITIONS.portal.fields);

    expect(groups.map((group) => group.label)).toEqual([
      'Placement',
      'Gameplay',
      'Question Link',
    ]);
  });

  it('flags objects that are not placed inside any map cell', () => {
    const levelData = {
      viewport: { width: 1280, height: 720 },
      questions: [{ id: 'q-1' }],
      grid: {
        cells: [{ id: 'cell-1', col: 0, row: 0, backgroundKey: 'tutorialGrove', objective: '', postUnlockObjective: '' }],
      },
      worldObjects: {},
    };

    const messages = getObjectValidationMessages({
      entry: {
        editorId: 'portal-1',
        type: 'portal',
        definition: WORLD_OBJECT_DEFINITIONS.portal,
        object: {
          x: 1800,
          y: 560,
          questionId: 'q-1',
          endsLevel: true,
          locked: false,
        },
      },
      levelData,
      source,
    });

    expect(messages.some((message) => message.id === 'outside-cell')).toBe(true);
  });

  it('keeps cell validation ids unique when multiple objects share the same warning type', () => {
    const cellObjects = [
      {
        editorId: 'platform-1',
        type: 'platforms',
        definition: WORLD_OBJECT_DEFINITIONS.platforms,
        object: { x: -20, y: 50, width: 240, bodyHeight: 24, textureKey: 'grass' },
      },
      {
        editorId: 'platform-2',
        type: 'platforms',
        definition: WORLD_OBJECT_DEFINITIONS.platforms,
        object: { x: 980, y: 50, width: 240, bodyHeight: 24, textureKey: 'grass' },
      },
    ];

    const messages = getCellValidationMessages({
      cell: { id: 'cell-1', col: 0, row: 0, backgroundKey: 'tutorialGrove', objective: '', postUnlockObjective: '' },
      levelData: {
        viewport: { width: 900, height: 600 },
        questions: [],
        grid: {
          cells: [{ id: 'cell-1', col: 0, row: 0, backgroundKey: 'tutorialGrove', objective: '', postUnlockObjective: '' }],
        },
      },
      source,
      cellObjects,
    });

    expect(messages).toHaveLength(2);
    expect(new Set(messages.map((message) => message.id)).size).toBe(2);
  });

  it('warns when the level is missing a completion portal', () => {
    const messages = getLevelValidationMessages({
      levelData: {
        viewport: { width: 1280, height: 720 },
        grid: {
          cells: [{ id: 'cell-1', col: 0, row: 0, backgroundKey: 'tutorialGrove', objective: '', postUnlockObjective: '' }],
        },
        worldObjects: {
          spawn: { x: 160, y: 560 },
          portal: [],
        },
      },
    });

    expect(messages.some((message) => message.id === 'level-missing-portal')).toBe(true);
  });
});
