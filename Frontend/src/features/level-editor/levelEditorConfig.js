import { gameOneRuntimeAssets } from '../../games/game-one/assets/manifest/runtimeAssets';

const numericField = (key, label, overrides = {}) => ({
  key,
  label,
  type: 'number',
  ...overrides,
});

const textField = (key, label, overrides = {}) => ({
  key,
  label,
  type: 'text',
  ...overrides,
});

const checkboxField = (key, label, overrides = {}) => ({
  key,
  label,
  type: 'checkbox',
  ...overrides,
});

const selectField = (key, label, optionsResolver, overrides = {}) => ({
  key,
  label,
  type: 'select',
  optionsResolver,
  ...overrides,
});

const textareaField = (key, label, overrides = {}) => ({
  key,
  label,
  type: 'textarea',
  ...overrides,
});

const createBackgroundOptions = ({ source }) => (
  Object.keys(source?.runtimeAssets?.manifest?.backgrounds || {}).map((value) => ({
    value,
    label: value,
  }))
);

const createQuestionOptions = (levelData, includeEmptyOption = false) => {
  const options = (levelData?.questions || []).map((question) => ({
    value: question.id,
    label: question.id,
  }));

  return includeEmptyOption
    ? [{ value: '', label: 'None' }, ...options]
    : options;
};

export const CELL_FIELD_DEFINITIONS = Object.freeze([
  textField('id', 'Cell Id', { group: 'Identity' }),
  numericField('col', 'Grid Column', { group: 'Placement' }),
  numericField('row', 'Grid Row', { group: 'Placement' }),
  selectField('backgroundKey', 'Background', createBackgroundOptions, { group: 'Visuals' }),
  textareaField('objective', 'Objective', { group: 'Objectives' }),
  textareaField('postUnlockObjective', 'Post-Unlock Objective', { group: 'Objectives' }),
]);

export const WORLD_OBJECT_DEFINITIONS = Object.freeze({
  spawn: {
    type: 'spawn',
    storageKey: 'spawn',
    label: 'Spawn',
    shortLabel: 'SP',
    shape: 'point',
    color: '#0284c7',
    singleton: true,
    defaultValue: () => ({
      x: 160,
      y: 560,
    }),
    fields: Object.freeze([
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
    ]),
  },
  platforms: {
    type: 'platforms',
    storageKey: 'platforms',
    label: 'Platform',
    shortLabel: 'PL',
    shape: 'rect',
    color: '#16a34a',
    singleton: false,
    defaultValue: ({ nextId, defaultTextureKey }) => ({
      id: nextId,
      x: 640,
      y: 520,
      width: 240,
      bodyHeight: 24,
      textureKey: defaultTextureKey,
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      numericField('width', 'Width', { group: 'Bounds' }),
      numericField('bodyHeight', 'Body Height', { group: 'Bounds' }),
      numericField('height', 'Visual Height', { placeholder: 'Optional', group: 'Bounds' }),
      selectField('textureKey', 'Texture', ({ source }) => (
        Object.keys(source?.runtimeAssets?.manifest?.platforms || {}).map((value) => ({
          value,
          label: value,
        }))
      ), { group: 'Visuals' }),
      textField('collisionMode', 'Collision Mode', { placeholder: 'Optional', group: 'Gameplay' }),
    ]),
  },
  unlockPlatforms: {
    type: 'unlockPlatforms',
    storageKey: 'unlockPlatforms',
    label: 'Unlock Platform',
    shortLabel: 'UP',
    shape: 'rect',
    color: '#22c55e',
    singleton: false,
    defaultValue: ({ nextId, defaultTextureKey, firstQuestionId }) => ({
      id: nextId,
      x: 640,
      y: 440,
      width: 200,
      bodyHeight: 24,
      textureKey: defaultTextureKey,
      lockedByQuestionId: firstQuestionId,
      startsHidden: true,
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      numericField('width', 'Width', { group: 'Bounds' }),
      numericField('bodyHeight', 'Body Height', { group: 'Bounds' }),
      selectField('textureKey', 'Texture', ({ source }) => (
        Object.keys(source?.runtimeAssets?.manifest?.platforms || {}).map((value) => ({
          value,
          label: value,
        }))
      ), { group: 'Visuals' }),
      selectField('lockedByQuestionId', 'Question Lock', ({ levelData }) => (
        createQuestionOptions(levelData, false)
      ), { group: 'Question Link' }),
      checkboxField('startsHidden', 'Starts Hidden', { group: 'Gameplay' }),
    ]),
  },
  barriers: {
    type: 'barriers',
    storageKey: 'barriers',
    label: 'Barrier',
    shortLabel: 'BR',
    shape: 'rect',
    color: '#b45309',
    singleton: false,
    defaultValue: ({ nextId, defaultTextureKey, firstQuestionId }) => ({
      id: nextId,
      x: 640,
      y: 500,
      width: 72,
      height: 176,
      bodyHeight: 168,
      textureKey: defaultTextureKey,
      lockedByQuestionId: firstQuestionId,
      unlockBehavior: 'drop',
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      numericField('width', 'Width', { group: 'Bounds' }),
      numericField('height', 'Height', { group: 'Bounds' }),
      numericField('bodyHeight', 'Body Height', { group: 'Bounds' }),
      selectField('textureKey', 'Texture', ({ source }) => (
        Object.keys(source?.runtimeAssets?.manifest?.platforms || {}).map((value) => ({
          value,
          label: value,
        }))
      ), { group: 'Visuals' }),
      selectField('lockedByQuestionId', 'Question Lock', ({ levelData }) => (
        createQuestionOptions(levelData, false)
      ), { group: 'Question Link' }),
      textField('unlockBehavior', 'Unlock Behavior', { group: 'Gameplay' }),
    ]),
  },
  coins: {
    type: 'coins',
    storageKey: 'coins',
    label: 'Coin',
    shortLabel: 'CO',
    shape: 'point',
    color: '#f59e0b',
    singleton: false,
    defaultValue: ({ nextId }) => ({
      id: nextId,
      x: 640,
      y: 420,
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
    ]),
  },
  ghosts: {
    type: 'ghosts',
    storageKey: 'ghosts',
    label: 'Ghost',
    shortLabel: 'GH',
    shape: 'point',
    color: '#8b5cf6',
    singleton: false,
    defaultValue: ({ nextId }) => ({
      id: nextId,
      x: 640,
      y: 592,
      patrolDistance: 220,
      speed: 80,
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      numericField('patrolDistance', 'Patrol Distance', { group: 'Behavior' }),
      numericField('speed', 'Speed', { group: 'Behavior' }),
    ]),
  },
  projectileEnemies: {
    type: 'projectileEnemies',
    storageKey: 'projectileEnemies',
    label: 'Projectile Enemy',
    shortLabel: 'PE',
    shape: 'point',
    color: '#dc2626',
    singleton: false,
    defaultValue: ({ nextId }) => ({
      id: nextId,
      enemyType: 'elemental',
      x: 920,
      y: 556,
      fireDirection: 'LEFT',
      fireIntervalMs: 1800,
      projectileSpeed: 285,
      projectileLifetimeMs: 2550,
      initialDelayMs: 900,
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      selectField('enemyType', 'Enemy Type', () => (
        ['elemental', 'hunter', 'boss'].map((value) => ({ value, label: value }))
      ), { group: 'Visuals' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      selectField('fireDirection', 'Fire Direction', () => (
        ['LEFT', 'RIGHT'].map((value) => ({ value, label: value }))
      ), { group: 'Projectile' }),
      numericField('fireIntervalMs', 'Fire Interval (ms)', { group: 'Projectile' }),
      numericField('projectileSpeed', 'Projectile Speed', { group: 'Projectile' }),
      numericField('projectileLifetimeMs', 'Projectile Lifetime', { group: 'Projectile' }),
      numericField('initialDelayMs', 'Initial Delay', { group: 'Projectile' }),
      numericField('hitPoints', 'Hit Points', { group: 'Behavior' }),
    ]),
  },
  villain: {
    type: 'villain',
    storageKey: 'villain',
    label: 'Question Trigger',
    shortLabel: 'QT',
    shape: 'point',
    color: '#f97316',
    singleton: false,
    defaultValue: ({ nextId, firstQuestionId }) => ({
      id: nextId,
      x: 640,
      y: 500,
      questionId: firstQuestionId,
      appearance: 'VILLAIN',
      interactionLabel: 'villain',
    }),
    fields: Object.freeze([
      textField('id', 'Id', { group: 'Identity' }),
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      selectField('questionId', 'Question', ({ levelData }) => (
        createQuestionOptions(levelData, false)
      ), { group: 'Question Link' }),
      selectField('appearance', 'Appearance', () => (
        ['VILLAIN', 'STATUE'].map((value) => ({ value, label: value }))
      ), { group: 'Visuals' }),
      textField('interactionLabel', 'Interaction Label', { group: 'Visuals' }),
    ]),
  },
  portal: {
    type: 'portal',
    storageKey: 'portal',
    label: 'Portal',
    shortLabel: 'PT',
    shape: 'point',
    color: '#0ea5e9',
    singleton: false,
    defaultValue: () => ({
      x: 1135,
      y: 556,
      locked: false,
      endsLevel: true,
      questionId: null,
      linkName: '',
    }),
    fields: Object.freeze([
      numericField('x', 'X', { group: 'Placement' }),
      numericField('y', 'Y', { group: 'Placement' }),
      checkboxField('locked', 'Locked', { group: 'Gameplay' }),
      textField('linkName', 'Portal Name', { group: 'Gameplay' }),
      selectField('questionId', 'Question Lock', ({ levelData }) => (
        createQuestionOptions(levelData, true)
      ), { group: 'Question Link' }),
    ]),
  },
});

export const WORLD_OBJECT_ORDER = Object.freeze([
  'spawn',
  'platforms',
  'unlockPlatforms',
  'barriers',
  'coins',
  'ghosts',
  'projectileEnemies',
  'villain',
  'portal',
]);

export const ROOM_FIELD_DEFINITIONS = CELL_FIELD_DEFINITIONS;
export const ROOM_OBJECT_DEFINITIONS = WORLD_OBJECT_DEFINITIONS;
export const ROOM_OBJECT_ORDER = WORLD_OBJECT_ORDER;

export const LEVEL_EDITOR_SOURCES = Object.freeze({
  GAME_ONE: {
    gameType: 'GAME_ONE',
    label: 'Game 1',
    title: '2D Phaser Adventure',
    runtimeAssets: gameOneRuntimeAssets,
    defaultLevelNumber: 1,
    createBlankCell: ({ nextCellId, col = 0, row = 0 }) => ({
      id: nextCellId,
      col,
      row,
      backgroundKey: 'tutorialGrove',
      objective: 'Design the route through this area.',
      postUnlockObjective: '',
    }),
    createBlankLevel: ({ levelNumber = 1, nextCellId = 'cell-1' }) => ({
      version: 2,
      id: `game_one-level-${String(levelNumber).padStart(2, '0')}`,
      gameType: 'GAME_ONE',
      levelNumber,
      title: `Level ${levelNumber}`,
      subtitle: '',
      viewport: {
        width: 1280,
        height: 720,
      },
      questions: [],
      grid: {
        cells: [
          {
            id: nextCellId,
            col: 0,
            row: 0,
            backgroundKey: 'tutorialGrove',
            objective: 'Design the route through this area.',
            postUnlockObjective: '',
          },
        ],
      },
      worldObjects: {
        spawn: {
          x: 160,
          y: 560,
        },
        platforms: [
          {
            id: 'floor',
            x: 640,
            y: 684,
            width: 1280,
            bodyHeight: 72,
            textureKey: 'grass',
          },
        ],
        unlockPlatforms: [],
        barriers: [],
        coins: [],
        ghosts: [],
        projectileEnemies: [],
        villain: [],
        portal: [],
      },
    }),
  },
});

export const getLevelEditorSource = (gameType) => LEVEL_EDITOR_SOURCES[gameType] || null;
