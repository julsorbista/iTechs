export const ROOM_CHUNK_SCHEMA_VERSION = 1;

const DEFAULT_BACKGROUND_KEY = 'tutorialGrove';
const DEFAULT_GRID_ROWS = 18;
const DEFAULT_GRID_COLS = 32;
const MAX_ROOMS = 500;
const MAX_ROOM_COMPONENTS = 200;
const MAX_ROOM_BACKGROUND_TILES = 1200;
const STATUE_TOPIC_MAX_LENGTH = 140;
const DEFAULT_LEVEL_PLAYER_HEALTH = 3;
const DEFAULT_LEVEL_TIMER_SECONDS = 120;
const DEFAULT_ROOM_TILE_SIZE = 96;
const MAX_ROOM_TILE_SIZE = 1024;
const MAX_ROOM_TILE_Z_INDEX = 9999;
const MIN_ROOM_TILE_ROTATION = 0;
const MAX_ROOM_TILE_ROTATION = 359;
const DEFAULT_ROOM_BACKGROUND_COLOR = '#111827';
const PASS_THROUGH_SIDES = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
const GHOST_MOVEMENT_DIRECTIONS = ['LEFT', 'RIGHT', 'UP', 'DOWN'];
const STATUE_AI_DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'];
const DEFAULT_STATUE_AI_LANGUAGE = 'English';
const COMPONENT_TYPES = new Set([
  'spawn',
  'platform',
  'invisiblePlatform',
  'coin',
  'ghost',
  'projectileEnemy',
  'barrier',
  'portal',
  'statue',
]);

const LEGACY_PORTAL_COMPONENT_X = 1135;
const LEGACY_PORTAL_COMPONENT_Y = 556;

const clampInteger = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

export const createDefaultRoomChunkData = () => ({
  version: ROOM_CHUNK_SCHEMA_VERSION,
  grid: {
    rows: DEFAULT_GRID_ROWS,
    cols: DEFAULT_GRID_COLS,
  },
  settings: {
    backgroundKey: DEFAULT_BACKGROUND_KEY,
    playerHealth: DEFAULT_LEVEL_PLAYER_HEALTH,
    timerEnabled: false,
    timerSeconds: DEFAULT_LEVEL_TIMER_SECONDS,
  },
  rooms: [
    {
      id: 'room-1',
      name: 'Room 1',
      row: 0,
      col: 0,
      backgroundKey: DEFAULT_BACKGROUND_KEY,
      backgroundColor: DEFAULT_ROOM_BACKGROUND_COLOR,
      links: [],
      components: [],
      backgroundTiles: [],
    },
  ],
});

const normalizeLinks = (links, roomIds) => {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link) => {
      if (!link || typeof link !== 'object') {
        return null;
      }

      const targetRoomId = typeof link.targetRoomId === 'string' ? link.targetRoomId.trim() : '';
      if (!targetRoomId || !roomIds.has(targetRoomId)) {
        return null;
      }

      const doorway = typeof link.doorway === 'string' ? link.doorway.trim().toUpperCase() : 'AUTO';
      const normalizedDoorway = ['N', 'E', 'S', 'W', 'AUTO'].includes(doorway) ? doorway : 'AUTO';

      return {
        targetRoomId,
        doorway: normalizedDoorway,
      };
    })
    .filter(Boolean);
};

const normalizePortal = (portal, roomIds) => {
  if (!portal || typeof portal !== 'object' || Array.isArray(portal)) {
    return {
      targetRoomId: null,
      endsLevel: true,
    };
  }

  const targetRoomId = typeof portal.targetRoomId === 'string' ? portal.targetRoomId.trim() : '';
  const hasValidTarget = Boolean(targetRoomId) && roomIds.has(targetRoomId);

  const endsLevel = hasValidTarget ? false : true;

  return {
    targetRoomId: hasValidTarget ? targetRoomId : null,
    endsLevel,
  };
};

const normalizePassThroughSides = (value) => {
  if (Array.isArray(value)) {
    const nextSides = value
      .map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : ''))
      .filter((entry) => PASS_THROUGH_SIDES.includes(entry));

    return Array.from(new Set(nextSides));
  }

  if (isPlainObject(value)) {
    return PASS_THROUGH_SIDES.filter((side) => {
      const lowercase = side.toLowerCase();
      return Boolean(value[lowercase] || value[side]);
    });
  }

  return [];
};

const normalizeStatueChoices = (value) => {
  const source = Array.isArray(value) ? value : [];
  const trimmed = source
    .map((entry) => (typeof entry === 'string' ? entry.trim().slice(0, 120) : ''))
    .filter(Boolean)
    .slice(0, 4);

  if (trimmed.length >= 2) {
    return trimmed;
  }

  return ['A', 'B', 'C', 'D'];
};

const normalizeStatueQuestionTopic = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.slice(0, STATUE_TOPIC_MAX_LENGTH);
};

const normalizeStatueAIDifficulty = (value) => {
  if (typeof value !== 'string') {
    return 'medium';
  }

  const normalized = value.trim().toLowerCase();
  return STATUE_AI_DIFFICULTY_OPTIONS.includes(normalized)
    ? normalized
    : 'medium';
};

const normalizeStatueLanguage = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_STATUE_AI_LANGUAGE;
  }

  const normalized = value.trim().slice(0, 40);
  return normalized || DEFAULT_STATUE_AI_LANGUAGE;
};

const normalizeStatueGradeLevel = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 40);
};

const normalizeStatueInstructions = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 500);
};

const normalizeLevelSettings = (settings, fallbackBackground = DEFAULT_BACKGROUND_KEY) => {
  const source = isPlainObject(settings) ? settings : {};
  const backgroundKey = typeof source.backgroundKey === 'string' && source.backgroundKey.trim()
    ? source.backgroundKey.trim().slice(0, 40)
    : fallbackBackground;
  const timerEnabled = Boolean(source.timerEnabled);

  return {
    backgroundKey,
    playerHealth: clampInteger(source.playerHealth, 1, 10, DEFAULT_LEVEL_PLAYER_HEALTH),
    timerEnabled,
    timerSeconds: clampInteger(source.timerSeconds, 10, 3600, DEFAULT_LEVEL_TIMER_SECONDS),
  };
};

const sanitizeTextureKey = (value, fallback = 'grass') => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.trim().slice(0, 40);
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeBackgroundColor = (value, fallback = DEFAULT_ROOM_BACKGROUND_COLOR) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : fallback;
};

const normalizeTileRotation = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return clampInteger(fallback, MIN_ROOM_TILE_ROTATION, MAX_ROOM_TILE_ROTATION, 0);
  }

  const rounded = Math.round(parsed);
  const normalized = ((rounded % 360) + 360) % 360;
  return clampInteger(normalized, MIN_ROOM_TILE_ROTATION, MAX_ROOM_TILE_ROTATION, 0);
};

const normalizeBackgroundTiles = (tiles) => {
  if (!Array.isArray(tiles)) {
    return [];
  }

  const usedIds = new Set();

  return tiles
    .slice(0, MAX_ROOM_BACKGROUND_TILES)
    .map((tile, index) => {
      if (!isPlainObject(tile)) {
        return null;
      }

      const tileKey = typeof tile.tileKey === 'string'
        ? tile.tileKey.trim().slice(0, 120)
        : '';

      if (!tileKey) {
        return null;
      }

      const rawId = typeof tile.id === 'string' && tile.id.trim()
        ? tile.id.trim().slice(0, 80)
        : `tile-${index + 1}`;

      let id = rawId;
      while (usedIds.has(id)) {
        id = `${rawId}-${usedIds.size + 1}`.slice(0, 80);
      }
      usedIds.add(id);

      return {
        id,
        tileKey,
        x: clampInteger(tile.x, 0, 1280, 640),
        y: clampInteger(tile.y, 0, 720, 360),
        size: clampInteger(tile.size, 16, MAX_ROOM_TILE_SIZE, DEFAULT_ROOM_TILE_SIZE),
        zIndex: clampInteger(tile.zIndex, 0, MAX_ROOM_TILE_Z_INDEX, index),
        rotationDeg: normalizeTileRotation(tile.rotationDeg, 0),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
      };
    })
    .filter(Boolean);
};

const createLegacyPortalComponent = (roomId, sourcePortal) => ({
  id: `cmp-portal-${roomId}`.slice(0, 80),
  type: 'portal',
  x: LEGACY_PORTAL_COMPONENT_X,
  y: LEGACY_PORTAL_COMPONENT_Y,
  locked: false,
  endsLevel: isPlainObject(sourcePortal) ? sourcePortal.endsLevel !== false : true,
  linkName: '',
});

const normalizeComponents = (components, sharedPortalLinkNameCounts = null) => {
  if (!Array.isArray(components)) {
    return [];
  }

  const usedIds = new Set();
  const portalLinkNameCounts = sharedPortalLinkNameCounts || new Map();

  return components
    .slice(0, MAX_ROOM_COMPONENTS)
    .map((component, index) => {
      if (!component || typeof component !== 'object' || Array.isArray(component)) {
        return null;
      }

      const rawType = typeof component.type === 'string' ? component.type.trim() : '';
      const type = rawType && COMPONENT_TYPES.has(rawType) ? rawType : null;
      if (!type) {
        return null;
      }

      const x = clampInteger(component.x, 0, 1280, 640);
      const y = clampInteger(component.y, 0, 720, 360);

      const rawId = typeof component.id === 'string' && component.id.trim()
        ? component.id.trim().slice(0, 80)
        : `cmp-${type}-${index + 1}`;
      let id = rawId;
      if (usedIds.has(id)) {
        id = `${rawId}-${index + 1}`.slice(0, 80);
      }
      while (usedIds.has(id)) {
        id = `${rawId}-${usedIds.size + 1}`.slice(0, 80);
      }
      usedIds.add(id);

      const normalized = {
        id,
        type,
        x,
        y,
      };

      if (type === 'platform') {
        normalized.width = clampInteger(component.width, 40, 1280, 220);
        normalized.bodyHeight = clampInteger(component.bodyHeight, 8, 220, 24);
        normalized.textureKey = sanitizeTextureKey(component.textureKey, 'grass');
      }

      if (type === 'barrier') {
        normalized.width = clampInteger(component.width, 24, 640, 72);
        normalized.height = clampInteger(component.height, 32, 720, 176);
        normalized.bodyHeight = clampInteger(component.bodyHeight, 16, 720, 168);
        normalized.textureKey = sanitizeTextureKey(component.textureKey, 'stone');
      }

      if (type === 'ghost') {
        normalized.patrolDistance = clampInteger(component.patrolDistance, 20, 1200, 220);
        normalized.speed = clampInteger(component.speed, 10, 600, 80);
        const movementDirection = typeof component.movementDirection === 'string'
          ? component.movementDirection.trim().toUpperCase()
          : 'LEFT';
        normalized.movementDirection = GHOST_MOVEMENT_DIRECTIONS.includes(movementDirection)
          ? movementDirection
          : 'LEFT';
      }

      if (type === 'invisiblePlatform') {
        normalized.width = clampInteger(component.width, 40, 1280, 220);
        normalized.height = clampInteger(component.height, 8, 360, 36);
        normalized.passThroughSides = normalizePassThroughSides(component.passThroughSides);
      }

      if (type === 'projectileEnemy') {
        const fireDirection = typeof component.fireDirection === 'string'
          ? component.fireDirection.trim().toUpperCase()
          : 'LEFT';
        normalized.enemyType = 'elemental';
        normalized.fireDirection = ['LEFT', 'RIGHT'].includes(fireDirection) ? fireDirection : 'LEFT';
        normalized.fireIntervalMs = clampInteger(component.fireIntervalMs, 300, 12000, 1800);
        normalized.projectileSpeed = clampInteger(component.projectileSpeed, 60, 900, 285);
        normalized.projectileLifetimeMs = clampInteger(component.projectileLifetimeMs, 200, 12000, 2550);
        normalized.initialDelayMs = clampInteger(component.initialDelayMs, 0, 12000, 900);
      }

      if (type === 'portal') {
        const rawLinkName = typeof component.linkName === 'string' ? component.linkName.trim().slice(0, 40) : '';
        const currentCount = rawLinkName ? (portalLinkNameCounts.get(rawLinkName) || 0) : 0;
        if (rawLinkName && currentCount < 2) {
          normalized.linkName = rawLinkName;
          portalLinkNameCounts.set(rawLinkName, currentCount + 1);
        } else {
          normalized.linkName = '';
        }

        normalized.locked = Boolean(component.locked);
        normalized.endsLevel = Boolean(component.endsLevel);
      }

      if (type === 'statue') {
        normalized.questionId = typeof component.questionId === 'string' ? component.questionId.trim().slice(0, 80) : '';
        normalized.questionTopic = normalizeStatueQuestionTopic(component.questionTopic);
        normalized.aiChoicesCount = clampInteger(component.aiChoicesCount, 2, 6, 4);
        normalized.aiDifficulty = normalizeStatueAIDifficulty(component.aiDifficulty);
        normalized.aiLanguage = normalizeStatueLanguage(component.aiLanguage);
        normalized.aiGradeLevel = normalizeStatueGradeLevel(component.aiGradeLevel);
        normalized.aiInstructions = normalizeStatueInstructions(component.aiInstructions);
        normalized.prompt = typeof component.prompt === 'string' && component.prompt.trim()
          ? component.prompt.trim().slice(0, 240)
          : 'Solve the statue riddle.';
        normalized.choices = normalizeStatueChoices(component.choices);
        normalized.correctAnswerIndex = clampInteger(
          component.correctAnswerIndex,
          0,
          Math.max(0, normalized.choices.length - 1),
          0,
        );
        normalized.successText = typeof component.successText === 'string' && component.successText.trim()
          ? component.successText.trim().slice(0, 180)
          : 'Correct! The statue grants your request.';
        normalized.failureText = typeof component.failureText === 'string' && component.failureText.trim()
          ? component.failureText.trim().slice(0, 180)
          : 'Not quite. Try again.';
      }

      return normalized;
    })
    .filter(Boolean);
};

export const normalizeRoomChunkData = (value, options = {}) => {
  const fallbackBackground = options.fallbackBackgroundKey || DEFAULT_BACKGROUND_KEY;
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : createDefaultRoomChunkData();
  const settings = normalizeLevelSettings(raw.settings, fallbackBackground);

  const gridRows = clampInteger(raw.grid?.rows, 8, 80, DEFAULT_GRID_ROWS);
  const gridCols = clampInteger(raw.grid?.cols, 8, 80, DEFAULT_GRID_COLS);

  const roomCandidates = Array.isArray(raw.rooms) ? raw.rooms.slice(0, MAX_ROOMS) : [];
  const roomIds = new Set();
  const roomsWithSourceLinks = [];

  for (const candidate of roomCandidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const id = typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id.trim().slice(0, 80)
      : `room-${roomsWithSourceLinks.length + 1}`;

    if (roomIds.has(id)) {
      continue;
    }

    roomIds.add(id);

    roomsWithSourceLinks.push({
      id,
      name: typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name.trim().slice(0, 80)
        : `Room ${roomsWithSourceLinks.length + 1}`,
      row: clampInteger(candidate.row, 0, 79, 0),
      col: clampInteger(candidate.col, 0, 79, 0),
      backgroundKey: typeof candidate.backgroundKey === 'string' && candidate.backgroundKey.trim()
        ? candidate.backgroundKey.trim().slice(0, 40)
        : settings.backgroundKey,
      backgroundColor: normalizeBackgroundColor(candidate.backgroundColor, DEFAULT_ROOM_BACKGROUND_COLOR),
      sourceLinks: candidate.links,
      sourcePortal: candidate.portal,
      sourceComponents: candidate.components,
      sourceBackgroundTiles: candidate.backgroundTiles,
    });
  }

  if (roomsWithSourceLinks.length === 0) {
    roomsWithSourceLinks.push({
      id: 'room-1',
      name: 'Room 1',
      row: 0,
      col: 0,
      backgroundKey: settings.backgroundKey,
      backgroundColor: DEFAULT_ROOM_BACKGROUND_COLOR,
      sourceLinks: [],
      sourcePortal: null,
      sourceComponents: [],
      sourceBackgroundTiles: [],
    });
    roomIds.add('room-1');
  }

  const portalLinkNameCounts = new Map();

  const rooms = roomsWithSourceLinks.map((room) => {
    const sourceComponents = Array.isArray(room.sourceComponents) ? room.sourceComponents : [];
    const hasPortalComponent = sourceComponents.some((component) => component?.type === 'portal');
    const componentsInput = hasPortalComponent || !isPlainObject(room.sourcePortal)
      ? sourceComponents
      : [...sourceComponents, createLegacyPortalComponent(room.id, room.sourcePortal)];

    return {
      id: room.id,
      name: room.name,
      row: room.row,
      col: room.col,
      backgroundKey: room.backgroundKey,
      backgroundColor: room.backgroundColor,
      links: normalizeLinks(room.sourceLinks, roomIds),
      portal: normalizePortal(room.sourcePortal, roomIds),
      components: normalizeComponents(componentsInput, portalLinkNameCounts),
      backgroundTiles: normalizeBackgroundTiles(room.sourceBackgroundTiles),
    };
  });

  return {
    version: ROOM_CHUNK_SCHEMA_VERSION,
    grid: {
      rows: gridRows,
      cols: gridCols,
    },
    settings,
    rooms,
  };
};

export const legacyCellBackgroundsToRoomChunk = (cellBackgrounds, gridRows = DEFAULT_GRID_ROWS, gridCols = DEFAULT_GRID_COLS) => {
  const entries = cellBackgrounds && typeof cellBackgrounds === 'object' && !Array.isArray(cellBackgrounds)
    ? Object.entries(cellBackgrounds)
    : [];

  const rooms = entries
    .filter(([key, backgroundKey]) => /^\d+:\d+$/.test(key) && typeof backgroundKey === 'string' && backgroundKey.trim())
    .slice(0, MAX_ROOMS)
    .map(([key, backgroundKey], index) => {
      const [rowPart, colPart] = key.split(':');
      return {
        id: `room-${rowPart}-${colPart}`,
        name: `Room ${index + 1}`,
        row: clampInteger(rowPart, 0, 79, 0),
        col: clampInteger(colPart, 0, 79, 0),
        backgroundKey: backgroundKey.trim().slice(0, 40),
        backgroundColor: DEFAULT_ROOM_BACKGROUND_COLOR,
        links: [],
        portal: {
          targetRoomId: null,
          endsLevel: true,
        },
        components: [],
        backgroundTiles: [],
      };
    });

  return normalizeRoomChunkData({
    version: ROOM_CHUNK_SCHEMA_VERSION,
    grid: {
      rows: gridRows,
      cols: gridCols,
    },
    rooms,
  });
};

export const roomChunkToLegacyCellBackgrounds = (roomChunkData) => {
  const normalized = normalizeRoomChunkData(roomChunkData);

  return normalized.rooms.reduce((accumulator, room) => {
    accumulator[`${room.row}:${room.col}`] = room.backgroundKey;
    return accumulator;
  }, {});
};

export const getNextRoomPosition = (rooms) => {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return { row: 0, col: 0 };
  }

  const sorted = [...rooms].sort((a, b) => {
    if (a.row !== b.row) {
      return a.row - b.row;
    }
    return a.col - b.col;
  });

  const last = sorted[sorted.length - 1];
  const nextCol = last.col + 1;
  if (nextCol <= 7) {
    return { row: last.row, col: nextCol };
  }

  return { row: last.row + 1, col: 0 };
};
