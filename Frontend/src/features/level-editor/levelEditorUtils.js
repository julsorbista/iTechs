import { WORLD_OBJECT_DEFINITIONS, WORLD_OBJECT_ORDER } from './levelEditorConfig';
import { getGameOneSpriteDisplaySize, getGameOneSurfaceMetrics } from '../../games/game-one/systems/rendering';

let editorSequence = 0;

const LEGACY_VERSION = 1;
export const LEVEL_DATA_VERSION = 2;
const DEFAULT_ROOM_BACKGROUND_COLOR = '#111827';
const MAX_RUNTIME_TILE_SIZE = 1024;
const MAX_RUNTIME_TILE_Z_INDEX = 9999;
const MIN_RUNTIME_TILE_ROTATION = 0;
const MAX_RUNTIME_TILE_ROTATION = 359;

const OBJECT_ID_PREFIXES = {
  platforms: 'platform',
  unlockPlatforms: 'unlock-platform',
  barriers: 'barrier',
  coins: 'coin',
  ghosts: 'ghost',
  projectileEnemies: 'projectile-enemy',
};

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const normalizeHexColor = (value, fallback = DEFAULT_ROOM_BACKGROUND_COLOR) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : fallback;
};

const normalizeRuntimeBackgroundTiles = (tiles, viewport) => {
  if (!Array.isArray(tiles)) {
    return [];
  }

  const maxX = Math.max(1, Number(viewport?.width) || 1280);
  const maxY = Math.max(1, Number(viewport?.height) || 720);

  return tiles
    .map((tile, index) => {
      if (!tile || typeof tile !== 'object' || Array.isArray(tile)) {
        return null;
      }

      const tileKey = typeof tile.tileKey === 'string' ? tile.tileKey.trim().slice(0, 120) : '';
      const imageUrl = typeof tile.imageUrl === 'string' ? tile.imageUrl.trim() : '';
      if (!tileKey || !imageUrl) {
        return null;
      }

      const id = typeof tile.id === 'string' && tile.id.trim()
        ? tile.id.trim().slice(0, 120)
        : `bg-tile-${index + 1}`;
      const textureKey = typeof tile.textureKey === 'string' && tile.textureKey.trim()
        ? tile.textureKey.trim().slice(0, 140)
        : `room-bg-tile-${id}`;

      return {
        id,
        tileKey,
        textureKey,
        imageUrl,
        x: clampNumber(tile.x, 0, maxX, Math.round(maxX * 0.5)),
        y: clampNumber(tile.y, 0, maxY, Math.round(maxY * 0.5)),
        size: clampNumber(tile.size, 16, MAX_RUNTIME_TILE_SIZE, 96),
        zIndex: clampNumber(tile.zIndex, 0, MAX_RUNTIME_TILE_Z_INDEX, index),
        rotationDeg: clampNumber((((Math.round(Number(tile.rotationDeg) || 0) % 360) + 360) % 360), MIN_RUNTIME_TILE_ROTATION, MAX_RUNTIME_TILE_ROTATION, 0),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
        blendMode: String(tile.blendMode || '').trim().toLowerCase() === 'screen'
          ? 'screen'
          : 'normal',
        __sourceIndex: index,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex) {
        return left.zIndex - right.zIndex;
      }

      return left.__sourceIndex - right.__sourceIndex;
    })
    .map(({ __sourceIndex, ...tile }) => tile);
};

const toGridNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const toCellKey = (col, row) => `${toGridNumber(col, 0)}:${toGridNumber(row, 0)}`;

const withEditorId = (value, prefix) => (
  value
    ? {
        ...value,
        _editorId: value._editorId || `${prefix}-${++editorSequence}`,
      }
    : value
);

const stripEditorState = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripEditorState);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      if (key === '_editorId') {
        return accumulator;
      }

      accumulator[key] = stripEditorState(nestedValue);
      return accumulator;
    }, {});
  }

  return value;
};

const createDefaultWorldObjects = () => ({
  spawn: null,
  platforms: [],
  unlockPlatforms: [],
  barriers: [],
  coins: [],
  ghosts: [],
  projectileEnemies: [],
  villain: [],
  portal: [],
  backgroundTiles: [],
});

const cloneObjectWithOffset = (value, offsetX, offsetY) => {
  const nextValue = cloneValue(value) || {};
  nextValue.x = Number(nextValue.x || 0) + offsetX;
  nextValue.y = Number(nextValue.y || 0) + offsetY;
  delete nextValue.targetRoomId;
  if (Object.prototype.hasOwnProperty.call(nextValue, 'endsLevel')) {
    nextValue.endsLevel = nextValue.endsLevel !== false;
  }
  return nextValue;
};

const normalizeViewport = (viewport = {}) => ({
  width: Math.max(320, Number(viewport.width) || 1280),
  height: Math.max(240, Number(viewport.height) || 720),
});

const getDefaultBackgroundKey = (source) => (
  Object.keys(source?.runtimeAssets?.manifest?.backgrounds || {})[0] || 'tutorialGrove'
);

const normalizeCell = (cell, index, source, occupiedCellKeys, fallback = null) => {
  const nextCell = cloneValue(cell) || {};
  let col = toGridNumber(nextCell.col, toGridNumber(fallback?.col, index));
  const row = toGridNumber(nextCell.row, toGridNumber(fallback?.row, 0));
  let guard = 0;

  while (occupiedCellKeys.has(toCellKey(col, row)) && guard < 500) {
    col += 1;
    guard += 1;
  }

  occupiedCellKeys.add(toCellKey(col, row));

  return {
    id: nextCell.id || `cell-${index + 1}`,
    col,
    row,
    backgroundKey: nextCell.backgroundKey || getDefaultBackgroundKey(source),
    backgroundColor: normalizeHexColor(nextCell.backgroundColor ?? fallback?.backgroundColor),
    objective: nextCell.objective || '',
    postUnlockObjective: nextCell.postUnlockObjective || '',
  };
};

const normalizeWorldObjectValue = (type, objectValue, context) => {
  const definition = WORLD_OBJECT_DEFINITIONS[type];

  if (definition.singleton) {
    if (!objectValue) {
      return type === 'spawn'
        ? withEditorId(definition.defaultValue(context), type)
        : null;
    }

    const nextValue = {
      ...cloneValue(objectValue),
    };

    if (type === 'portal') {
      nextValue.endsLevel = true;
      delete nextValue.targetRoomId;
    }

    return withEditorId(nextValue, type);
  }

  const values = Array.isArray(objectValue)
    ? objectValue
    : ((type === 'portal' || type === 'villain') && objectValue && typeof objectValue === 'object' ? [objectValue] : []);

  if (type === 'portal') {
    const linkNameCounts = new Map();

    return values.map((item, index) => {
      const nextItem = cloneValue(item) || {};
      delete nextItem.targetRoomId;
      nextItem.endsLevel = nextItem.endsLevel !== false;
      nextItem.locked = Boolean(nextItem.locked);
      const rawLinkName = typeof nextItem.linkName === 'string' ? nextItem.linkName.trim().slice(0, 40) : '';
      const currentCount = rawLinkName ? (linkNameCounts.get(rawLinkName) || 0) : 0;
      if (rawLinkName && currentCount < 2) {
        nextItem.linkName = rawLinkName;
        linkNameCounts.set(rawLinkName, currentCount + 1);
      } else {
        nextItem.linkName = '';
      }

      return withEditorId(nextItem, `${type}-${index + 1}`);
    });
  }

  return values.map((item, index) => withEditorId(cloneValue(item), `${type}-${index + 1}`));
};

const buildFallbackLevelData = (source, levelNumber) => {
  const nextCellId = 'cell-1';
  return cloneValue(source?.createBlankLevel?.({
    levelNumber,
    nextCellId,
  })) || {
    version: LEVEL_DATA_VERSION,
    id: `${source?.gameType?.toLowerCase() || 'game'}-level-${String(levelNumber).padStart(2, '0')}`,
    gameType: source?.gameType || 'GAME_ONE',
    levelNumber,
    title: `Level ${levelNumber}`,
    subtitle: '',
    viewport: { width: 1280, height: 720 },
    questions: [],
    grid: {
      cells: [
        {
          id: nextCellId,
          col: 0,
          row: 0,
          backgroundKey: getDefaultBackgroundKey(source),
          backgroundColor: DEFAULT_ROOM_BACKGROUND_COLOR,
          objective: '',
          postUnlockObjective: '',
        },
      ],
    },
    worldObjects: {
      ...createDefaultWorldObjects(),
      spawn: { x: 160, y: 560 },
    },
  };
};

const migrateLegacyLevelData = (levelData, source) => {
  const fallbackLevelNumber = Number(levelData?.levelNumber || source?.defaultLevelNumber || 1);
  const fallbackLevel = buildFallbackLevelData(source, fallbackLevelNumber);
  const viewport = normalizeViewport(levelData?.viewport || fallbackLevel.viewport);
  const rooms = Array.isArray(levelData?.rooms) ? levelData.rooms : [];
  const occupiedCellKeys = new Set();
  const cells = [];
  const worldObjects = createDefaultWorldObjects();

  rooms.forEach((room, index) => {
    const nextCell = normalizeCell({
      id: room?.id || `cell-${index + 1}`,
      col: room?.layout?.col,
      row: room?.layout?.row,
      backgroundKey: room?.backgroundKey,
      objective: room?.objective,
      postUnlockObjective: room?.postUnlockObjective,
    }, index, source, occupiedCellKeys, { col: index, row: 0 });
    const offsetX = nextCell.col * viewport.width;
    const offsetY = nextCell.row * viewport.height;

    cells.push(nextCell);

    if (!worldObjects.spawn && room?.spawn) {
      worldObjects.spawn = cloneObjectWithOffset(room.spawn, offsetX, offsetY);
    }

    ['platforms', 'unlockPlatforms', 'barriers', 'coins', 'ghosts', 'projectileEnemies'].forEach((type) => {
      const values = Array.isArray(room?.[type]) ? room[type] : [];
      worldObjects[type].push(...values.map((value) => cloneObjectWithOffset(value, offsetX, offsetY)));
    });

    const villains = Array.isArray(room?.villain)
      ? room.villain
      : (room?.villain ? [room.villain] : []);
    worldObjects.villain.push(...villains.map((value) => cloneObjectWithOffset(value, offsetX, offsetY)));

    if (room?.portal) {
      worldObjects.portal.push({
        ...cloneObjectWithOffset(room.portal, offsetX, offsetY),
        endsLevel: true,
        linkName: '',
      });
    }
  });

  const normalizedBase = {
    ...cloneValue(levelData),
    version: LEVEL_DATA_VERSION,
    gameType: levelData?.gameType || fallbackLevel.gameType,
    levelNumber: fallbackLevelNumber,
    id: levelData?.id || fallbackLevel.id,
    title: levelData?.title || fallbackLevel.title,
    subtitle: levelData?.subtitle || fallbackLevel.subtitle,
    viewport,
    questions: Array.isArray(levelData?.questions) ? cloneValue(levelData.questions) : [],
    grid: {
      cells: cells.length ? cells : cloneValue(fallbackLevel.grid.cells),
    },
    worldObjects: {
      ...createDefaultWorldObjects(),
      ...worldObjects,
    },
  };

  if (!normalizedBase.worldObjects.spawn) {
    normalizedBase.worldObjects.spawn = cloneValue(fallbackLevel.worldObjects.spawn);
  }

  return normalizedBase;
};

const normalizeWorldLevelData = (levelData, source) => {
  const fallbackLevelNumber = Number(levelData?.levelNumber || source?.defaultLevelNumber || 1);
  const fallbackLevel = buildFallbackLevelData(source, fallbackLevelNumber);
  const nextLevelData = cloneValue(levelData) || fallbackLevel;
  const occupiedCellKeys = new Set();

  nextLevelData.version = LEVEL_DATA_VERSION;
  nextLevelData.id = nextLevelData.id || fallbackLevel.id;
  nextLevelData.gameType = nextLevelData.gameType || source?.gameType || fallbackLevel.gameType;
  nextLevelData.levelNumber = Number(nextLevelData.levelNumber || fallbackLevelNumber);
  nextLevelData.title = nextLevelData.title || fallbackLevel.title;
  nextLevelData.subtitle = nextLevelData.subtitle || '';
  nextLevelData.viewport = normalizeViewport(nextLevelData.viewport || fallbackLevel.viewport);
  nextLevelData.questions = Array.isArray(nextLevelData.questions) ? nextLevelData.questions : [];
  nextLevelData.grid = nextLevelData.grid || {};
  nextLevelData.grid.cells = (Array.isArray(nextLevelData.grid.cells) ? nextLevelData.grid.cells : fallbackLevel.grid.cells)
    .map((cell, index) => normalizeCell(cell, index, source, occupiedCellKeys, { col: index, row: 0 }));

  if (!nextLevelData.grid.cells.length) {
    nextLevelData.grid.cells = cloneValue(fallbackLevel.grid.cells);
  }

  const worldObjects = nextLevelData.worldObjects || {};
  const backgroundTiles = normalizeRuntimeBackgroundTiles(worldObjects.backgroundTiles, nextLevelData.viewport);
  nextLevelData.worldObjects = WORLD_OBJECT_ORDER.reduce((accumulator, type) => {
    accumulator[type] = normalizeWorldObjectValue(type, worldObjects[type], {
      nextId: getNextObjectId(nextLevelData, type),
      defaultTextureKey: getDefaultTextureKey(source),
      firstQuestionId: getFirstQuestionId(nextLevelData),
    });
    return accumulator;
  }, {});
  nextLevelData.worldObjects.backgroundTiles = backgroundTiles;

  return nextLevelData;
};

export const cloneValue = (value) => {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
};

export const createEditorId = (prefix = 'editor') => `${prefix}-${Date.now().toString(36)}-${++editorSequence}`;

export const getStorageKey = (gameType, levelNumber) => `admin-level-editor:${gameType}:${levelNumber}`;

export const getFirstQuestionId = (levelData) => levelData?.questions?.[0]?.id || '';

export const getDefaultTextureKey = (source) => (
  Object.keys(source?.runtimeAssets?.manifest?.platforms || {})[0] || 'grass'
);

export const buildBackgroundLookup = (source) => {
  const imageUrlByAssetKey = Object.fromEntries(
    (source?.runtimeAssets?.images || []).map((entry) => [entry.key, entry.url])
  );

  return Object.entries(source?.runtimeAssets?.manifest?.backgrounds || {}).reduce(
    (accumulator, [backgroundKey, config]) => ({
      ...accumulator,
      [backgroundKey]: imageUrlByAssetKey[config.key] || '',
    }),
    {}
  );
};

export const normalizeLevelData = (levelData, source) => {
  const nextLevelData = !levelData || Number(levelData.version || LEGACY_VERSION) < LEVEL_DATA_VERSION
    ? migrateLegacyLevelData(levelData || {}, source)
    : cloneValue(levelData);

  return normalizeWorldLevelData(nextLevelData, source);
};

export const cleanLevelData = (levelData) => stripEditorState(levelData);

export const collectWorldObjects = (levelData) => {
  if (!levelData?.worldObjects) {
    return [];
  }

  return WORLD_OBJECT_ORDER.flatMap((type) => {
    const definition = WORLD_OBJECT_DEFINITIONS[type];
    const worldValue = levelData.worldObjects[definition.storageKey];

    if (definition.singleton) {
      return worldValue
        ? [{
            editorId: worldValue._editorId || `${type}-singleton`,
            type,
            storageKey: definition.storageKey,
            label: definition.label,
            shortLabel: definition.shortLabel,
            definition,
            object: worldValue,
            singleton: true,
            index: 0,
          }]
        : [];
    }

    return (worldValue || []).map((item, index) => ({
      editorId: item._editorId || `${type}-${index + 1}`,
      type,
      storageKey: definition.storageKey,
      label: definition.label,
      shortLabel: definition.shortLabel,
      definition,
      object: item,
      singleton: false,
      index,
    }));
  });
};

export const findWorldObjectEntry = (levelData, editorId) => (
  collectWorldObjects(levelData).find((entry) => entry.editorId === editorId) || null
);

export const updateWorldObject = (levelData, editorId, updater) => {
  const entry = findWorldObjectEntry(levelData, editorId);

  if (!entry) {
    return levelData;
  }

  if (entry.singleton) {
    return {
      ...levelData,
      worldObjects: {
        ...levelData.worldObjects,
        [entry.storageKey]: updater(cloneValue(entry.object)),
      },
    };
  }

  return {
    ...levelData,
    worldObjects: {
      ...levelData.worldObjects,
      [entry.storageKey]: levelData.worldObjects[entry.storageKey].map((item, index) => (
        index === entry.index
          ? updater(cloneValue(item))
          : item
      )),
    },
  };
};

export const removeWorldObject = (levelData, editorId) => {
  const entry = findWorldObjectEntry(levelData, editorId);

  if (!entry || entry.type === 'spawn') {
    return levelData;
  }

  if (entry.singleton) {
    return {
      ...levelData,
      worldObjects: {
        ...levelData.worldObjects,
        [entry.storageKey]: null,
      },
    };
  }

  return {
    ...levelData,
    worldObjects: {
      ...levelData.worldObjects,
      [entry.storageKey]: levelData.worldObjects[entry.storageKey].filter((item) => item._editorId !== editorId),
    },
  };
};

export const coerceFieldValue = (field, rawValue) => {
  if (field.type === 'number') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return 0;
    }

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  if (field.type === 'checkbox') {
    return Boolean(rawValue);
  }

  if (field.type === 'select') {
    return rawValue === '' ? null : rawValue;
  }

  return rawValue;
};

export const getNextCellId = (cells = []) => {
  const nextNumber = cells.reduce((highest, cell) => {
    const match = String(cell?.id || '').match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  return `cell-${nextNumber}`;
};

export const getNextObjectId = (levelData, type) => {
  const definition = WORLD_OBJECT_DEFINITIONS[type];
  const prefix = OBJECT_ID_PREFIXES[type] || type;
  const currentItems = Array.isArray(levelData?.worldObjects?.[definition.storageKey])
    ? levelData.worldObjects[definition.storageKey]
    : [];
  const highestId = currentItems.reduce((highest, item) => {
    const match = String(item?.id || '').match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `${prefix}-${highestId + 1}`;
};

export const snapValue = (value, enabled, gridSize = 20) => (
  enabled ? Math.round(value / gridSize) * gridSize : Math.round(value)
);

export const getCanvasPoint = (event, canvasElement, viewport) => {
  const bounds = canvasElement.getBoundingClientRect();
  const scaleX = viewport.width / bounds.width;
  const scaleY = viewport.height / bounds.height;

  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
  };
};

export const getLevelEditorObjectDimensions = (entry, source) => {
  if (!entry) {
    return { width: 34, height: 34 };
  }

  if (entry.definition.shape === 'rect') {
    const { visualHeight } = getGameOneSurfaceMetrics(source?.runtimeAssets?.manifest, entry.object);

    return {
      width: Number(entry.object.width || 120),
      height: Math.max(Number(visualHeight || 0), 28),
    };
  }

  if (entry.type === 'portal') {
    return getGameOneSpriteDisplaySize(source?.runtimeAssets?.manifest?.portal, { width: 64, height: 128 });
  }

  if (entry.type === 'villain') {
    const villain = source?.runtimeAssets?.manifest?.villain;
    const baseWidth = villain?.scale ? Math.round(122 * villain.scale) : 82;
    const baseHeight = villain?.scale ? Math.round(96 * villain.scale) : 102;

    if (entry.object?.appearance === 'STATUE') {
      return {
        width: Math.max(baseWidth, 112),
        height: Math.max(baseHeight, 104),
      };
    }

    return {
      width: baseWidth,
      height: baseHeight,
    };
  }

  if (entry.type === 'spawn') {
    return getGameOneSpriteDisplaySize(source?.runtimeAssets?.manifest?.player, { width: 96, height: 96 });
  }

  if (entry.type === 'coins') {
    return getGameOneSpriteDisplaySize(source?.runtimeAssets?.manifest?.coin, { width: 45, height: 45 });
  }

  if (entry.type === 'ghosts') {
    return getGameOneSpriteDisplaySize(source?.runtimeAssets?.manifest?.ghost, { width: 92, height: 92 });
  }

  if (entry.type === 'projectileEnemies') {
    return getGameOneSpriteDisplaySize(source?.runtimeAssets?.manifest?.projectileCaster, { width: 94, height: 94 });
  }

  return { width: 34, height: 34 };
};

export const getLevelEditorObjectBounds = (entry, source) => {
  const { width, height } = getLevelEditorObjectDimensions(entry, source);
  const x = Number(entry?.object?.x || 0);
  const y = Number(entry?.object?.y || 0);

  return {
    x,
    y,
    width,
    height,
    left: x - (width / 2),
    top: y - (height / 2),
    right: x + (width / 2),
    bottom: y + (height / 2),
  };
};

export const getCellBounds = (cell, viewport) => {
  const width = Number(viewport?.width || 1280);
  const height = Number(viewport?.height || 720);
  const left = Number(cell?.col || 0) * width;
  const top = Number(cell?.row || 0) * height;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    centerX: left + (width / 2),
    centerY: top + (height / 2),
  };
};

export const doesObjectIntersectCell = (entry, cell, levelData, source) => {
  if (!entry || !cell) {
    return false;
  }

  const bounds = getLevelEditorObjectBounds(entry, source);
  const cellBounds = getCellBounds(cell, levelData?.viewport);
  const intersectsRect = !(
    bounds.right < cellBounds.left
    || bounds.left > cellBounds.right
    || bounds.bottom < cellBounds.top
    || bounds.top > cellBounds.bottom
  );
  const originInside = (
    bounds.x >= cellBounds.left
    && bounds.x <= cellBounds.right
    && bounds.y >= cellBounds.top
    && bounds.y <= cellBounds.bottom
  );

  return intersectsRect || originInside;
};

export const getCellObjectEntries = (levelData, cellId, source) => {
  const targetCell = (levelData?.grid?.cells || []).find((cell) => cell.id === cellId);
  if (!targetCell) {
    return [];
  }

  return collectWorldObjects(levelData).filter((entry) => (
    doesObjectIntersectCell(entry, targetCell, levelData, source)
  ));
};
