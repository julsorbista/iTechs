const { randomUUID } = require('crypto');
const prisma = require('../lib/prisma');

const DEFAULT_GRID_ROWS = 18;
const DEFAULT_GRID_COLS = 32;
const ROOM_CHUNK_SCHEMA_VERSION = 1;
const VERSION_PAYLOAD_SCHEMA_VERSION = 1;
const EDITOR_GAME_TYPE = 'GAME_ONE';
const VERSION_STATE_DRAFT = 'DRAFT';
const VERSION_STATE_PUBLISHED = 'PUBLISHED';
const MAX_ROOM_COMPONENTS = 200;
const MAX_ROOM_BACKGROUND_TILES = 1200;
const DEFAULT_LEVEL_PLAYER_HEALTH = 3;
const DEFAULT_LEVEL_TIMER_SECONDS = 120;
const DEFAULT_LEVEL_COIN_GOAL = 0;
const DEFAULT_ROOM_TILE_SIZE = 96;
const MAX_ROOM_TILE_SIZE = 1024;
const MAX_ROOM_TILE_Z_INDEX = 9999;
const MIN_ROOM_TILE_ROTATION = 0;
const MAX_ROOM_TILE_ROTATION = 359;
const DEFAULT_ROOM_BACKGROUND_COLOR = '#111827';
const STATUE_TOPIC_MAX_LENGTH = 140;
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
let ensureTablePromise = null;

const ensureTeacherEditorTables = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = prisma.$transaction([
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`teacher_level_records\` (
            \`id\` VARCHAR(191) NOT NULL,
            \`teacherId\` VARCHAR(191) NOT NULL,
            \`levelNumber\` INTEGER NOT NULL,
            \`gridRows\` INTEGER NOT NULL DEFAULT 18,
            \`gridCols\` INTEGER NOT NULL DEFAULT 32,
            \`cellBackgrounds\` JSON NOT NULL,
            \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            \`updatedAt\` DATETIME(3) NOT NULL,

            UNIQUE INDEX \`teacher_level_records_teacherId_levelNumber_key\`(\`teacherId\`, \`levelNumber\`),
            INDEX \`teacher_level_records_teacherId_updatedAt_idx\`(\`teacherId\`, \`updatedAt\`),
            PRIMARY KEY (\`id\`),
            CONSTRAINT \`teacher_level_records_teacherId_fkey\`
                FOREIGN KEY (\`teacherId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`teacher_level_workspaces\` (
            \`id\` VARCHAR(191) NOT NULL,
            \`teacherId\` VARCHAR(191) NOT NULL,
            \`gameType\` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL DEFAULT 'GAME_ONE',
            \`levelNumber\` INTEGER NOT NULL,
            \`title\` VARCHAR(191) NULL,
            \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

            UNIQUE INDEX \`teacher_level_workspaces_teacherId_gameType_levelNumber_key\`(\`teacherId\`, \`gameType\`, \`levelNumber\`),
            INDEX \`teacher_level_workspaces_teacherId_updatedAt_idx\`(\`teacherId\`, \`updatedAt\`),
            PRIMARY KEY (\`id\`),
            CONSTRAINT \`teacher_level_workspaces_teacherId_fkey\`
                FOREIGN KEY (\`teacherId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`teacher_level_versions\` (
            \`id\` VARCHAR(191) NOT NULL,
            \`workspaceId\` VARCHAR(191) NOT NULL,
            \`state\` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
            \`versionNumber\` INTEGER NOT NULL,
            \`payload\` JSON NOT NULL,
            \`createdByUserId\` VARCHAR(191) NOT NULL,
            \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

            UNIQUE INDEX \`teacher_level_versions_workspaceId_state_versionNumber_key\`(\`workspaceId\`, \`state\`, \`versionNumber\`),
            INDEX \`teacher_level_versions_workspaceId_state_createdAt_idx\`(\`workspaceId\`, \`state\`, \`createdAt\`),
            INDEX \`teacher_level_versions_createdByUserId_createdAt_idx\`(\`createdByUserId\`, \`createdAt\`),
            PRIMARY KEY (\`id\`),
            CONSTRAINT \`teacher_level_versions_workspaceId_fkey\`
                FOREIGN KEY (\`workspaceId\`) REFERENCES \`teacher_level_workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT \`teacher_level_versions_createdByUserId_fkey\`
                FOREIGN KEY (\`createdByUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `),
    ]);
  }

  try {
    await ensureTablePromise;
  } catch (error) {
    ensureTablePromise = null;
    throw error;
  }
};

const clampDimension = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(80, Math.max(8, parsed));
};

const clampRoomCoordinate = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(79, Math.max(0, parsed));
};

const clampInteger = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const coerceJsonObject = (value) => {
  if (!value) {
    return null;
  }

  if (isPlainObject(value)) {
    return value;
  }

  const raw = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

const coerceInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
};

const toRoomId = (row, col) => `room-${row}-${col}`;

const normalizeRoomLinks = (links, roomIds) => {
  if (!Array.isArray(links)) {
    return [];
  }

  const seenTargets = new Set();

  return links.reduce((accumulator, link) => {
    if (!isPlainObject(link)) {
      return accumulator;
    }

    const targetRoomId = typeof link.targetRoomId === 'string' ? link.targetRoomId.trim() : '';
    if (!targetRoomId || !roomIds.has(targetRoomId) || seenTargets.has(targetRoomId)) {
      return accumulator;
    }

    seenTargets.add(targetRoomId);
    const doorway = typeof link.doorway === 'string' ? link.doorway.trim().toUpperCase() : 'AUTO';

    accumulator.push({
      targetRoomId,
      doorway: ['N', 'E', 'S', 'W', 'AUTO'].includes(doorway) ? doorway : 'AUTO',
    });

    return accumulator;
  }, []);
};

const normalizeRoomPortal = (portal, roomIds) => {
  if (!isPlainObject(portal)) {
    return {
      targetRoomId: null,
      endsLevel: true,
    };
  }

  const rawTargetRoomId = typeof portal.targetRoomId === 'string' ? portal.targetRoomId.trim() : '';
  const hasValidTarget = Boolean(rawTargetRoomId) && roomIds.has(rawTargetRoomId);

  return {
    targetRoomId: hasValidTarget ? rawTargetRoomId : null,
    endsLevel: hasValidTarget ? false : true,
  };
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
        rotationDeg: clampInteger(
          ((Math.round(Number(tile.rotationDeg) || 0) % 360) + 360) % 360,
          MIN_ROOM_TILE_ROTATION,
          MAX_ROOM_TILE_ROTATION,
          0,
        ),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
      };
    })
    .filter(Boolean);
};

const normalizeBackgroundColor = (value, fallback = DEFAULT_ROOM_BACKGROUND_COLOR) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : fallback;
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

const normalizeLevelSettings = (settings, fallbackBackground = 'tutorialGrove') => {
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
    coinGoal: clampInteger(source.coinGoal, 0, 999, DEFAULT_LEVEL_COIN_GOAL),
    requireBossDefeat: Boolean(source.requireBossDefeat),
  };
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

const normalizeRoomComponents = (components, sharedPortalLinkNameCounts = null) => {
  if (!Array.isArray(components)) {
    return [];
  }

  const usedIds = new Set();
  const portalLinkNameCounts = sharedPortalLinkNameCounts || new Map();

  return components
    .slice(0, MAX_ROOM_COMPONENTS)
    .reduce((accumulator, component, index) => {
      if (!isPlainObject(component)) {
        return accumulator;
      }

      const rawType = typeof component.type === 'string' ? component.type.trim() : '';
      if (!rawType || !COMPONENT_TYPES.has(rawType)) {
        return accumulator;
      }

      const rawId = typeof component.id === 'string' && component.id.trim()
        ? component.id.trim().slice(0, 80)
        : `cmp-${rawType}-${index + 1}`;
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
        type: rawType,
        x: clampInteger(component.x, 0, 1280, 640),
        y: clampInteger(component.y, 0, 720, 360),
      };

      if (rawType === 'platform') {
        normalized.width = clampInteger(component.width, 40, 1280, 220);
        normalized.bodyHeight = clampInteger(component.bodyHeight, 8, 220, 24);
        normalized.textureKey = typeof component.textureKey === 'string' && component.textureKey.trim()
          ? component.textureKey.trim().slice(0, 40)
          : 'grass';
      }

      if (rawType === 'barrier') {
        normalized.width = clampInteger(component.width, 24, 640, 72);
        normalized.height = clampInteger(component.height, 32, 720, 176);
        normalized.bodyHeight = clampInteger(component.bodyHeight, 16, 720, 168);
        normalized.textureKey = typeof component.textureKey === 'string' && component.textureKey.trim()
          ? component.textureKey.trim().slice(0, 40)
          : 'stone';
      }

      if (rawType === 'ghost') {
        normalized.patrolDistance = clampInteger(component.patrolDistance, 20, 1200, 220);
        normalized.speed = clampInteger(component.speed, 10, 600, 80);
        const movementDirection = typeof component.movementDirection === 'string'
          ? component.movementDirection.trim().toUpperCase()
          : 'LEFT';
        normalized.movementDirection = GHOST_MOVEMENT_DIRECTIONS.includes(movementDirection)
          ? movementDirection
          : 'LEFT';
      }

      if (rawType === 'invisiblePlatform') {
        normalized.width = clampInteger(component.width, 40, 1280, 220);
        normalized.height = clampInteger(component.height, 8, 360, 36);
        normalized.passThroughSides = normalizePassThroughSides(component.passThroughSides);
      }

      if (rawType === 'projectileEnemy') {
        const enemyType = typeof component.enemyType === 'string'
          ? component.enemyType.trim().toLowerCase()
          : 'elemental';
        const fireDirection = typeof component.fireDirection === 'string'
          ? component.fireDirection.trim().toUpperCase()
          : 'LEFT';
        normalized.enemyType = ['elemental', 'hunter', 'boss'].includes(enemyType)
          ? enemyType
          : 'elemental';
        normalized.fireDirection = ['LEFT', 'RIGHT'].includes(fireDirection) ? fireDirection : 'LEFT';
        normalized.fireIntervalMs = clampInteger(component.fireIntervalMs, 300, 12000, 1800);
        normalized.projectileSpeed = clampInteger(component.projectileSpeed, 60, 900, 285);
        normalized.projectileLifetimeMs = clampInteger(component.projectileLifetimeMs, 200, 12000, 2550);
        normalized.initialDelayMs = clampInteger(component.initialDelayMs, 0, 12000, 900);
        normalized.hitPoints = clampInteger(
          component.hitPoints,
          1,
          100,
          normalized.enemyType === 'boss' ? 8 : 1,
        );
      }

      if (rawType === 'portal') {
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

      if (rawType === 'statue') {
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

      accumulator.push(normalized);
      return accumulator;
    }, []);
};

const normalizeRoomChunkData = (roomChunkData, fallbackRows, fallbackCols) => {
  const safeValue = isPlainObject(roomChunkData) ? roomChunkData : {};
  const settings = normalizeLevelSettings(safeValue.settings, 'tutorialGrove');
  const gridRows = clampDimension(safeValue.grid?.rows, fallbackRows);
  const gridCols = clampDimension(safeValue.grid?.cols, fallbackCols);
  const rawRooms = Array.isArray(safeValue.rooms) ? safeValue.rooms.slice(0, 500) : [];

  const roomIds = new Set();
  const roomsWithSourceLinks = [];

  rawRooms.forEach((roomCandidate, index) => {
    if (!isPlainObject(roomCandidate)) {
      return;
    }

    const parsedRow = clampRoomCoordinate(roomCandidate.row, 0);
    const parsedCol = clampRoomCoordinate(roomCandidate.col, 0);

    const candidateId = typeof roomCandidate.id === 'string' ? roomCandidate.id.trim().slice(0, 80) : '';
    const roomId = candidateId || `room-${index + 1}`;
    if (roomIds.has(roomId)) {
      return;
    }

    roomIds.add(roomId);
    roomsWithSourceLinks.push({
      id: roomId,
      name: typeof roomCandidate.name === 'string' && roomCandidate.name.trim()
        ? roomCandidate.name.trim().slice(0, 80)
        : `Room ${roomsWithSourceLinks.length + 1}`,
      row: parsedRow,
      col: parsedCol,
      backgroundKey: typeof roomCandidate.backgroundKey === 'string' && roomCandidate.backgroundKey.trim()
        ? roomCandidate.backgroundKey.trim().slice(0, 40)
        : settings.backgroundKey,
      backgroundColor: normalizeBackgroundColor(roomCandidate.backgroundColor, DEFAULT_ROOM_BACKGROUND_COLOR),
      sourceLinks: roomCandidate.links,
      sourcePortal: roomCandidate.portal,
      sourceComponents: roomCandidate.components,
      sourceBackgroundTiles: roomCandidate.backgroundTiles,
    });
  });

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
      links: normalizeRoomLinks(room.sourceLinks, roomIds),
      portal: normalizeRoomPortal(room.sourcePortal, roomIds),
      components: normalizeRoomComponents(componentsInput, portalLinkNameCounts),
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

const isLegacyCellBackgroundMap = (value) => {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.keys(value).every((key) => /^\d+:\d+$/.test(key));
};

const legacyCellBackgroundsToRoomChunkData = (cellBackgrounds, gridRows, gridCols) => {
  const entries = isPlainObject(cellBackgrounds) ? Object.entries(cellBackgrounds) : [];

  const rooms = entries
    .filter(([key, backgroundValue]) => /^\d+:\d+$/.test(key) && typeof backgroundValue === 'string' && backgroundValue.trim())
    .slice(0, 500)
    .map(([key, backgroundValue], index) => {
      const [rowPart, colPart] = key.split(':');
      return {
        id: toRoomId(rowPart, colPart),
        name: `Room ${index + 1}`,
        row: Number(rowPart),
        col: Number(colPart),
        backgroundKey: backgroundValue.trim().slice(0, 40),
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
  }, gridRows, gridCols);
};

const roomChunkToLegacyCellBackgrounds = (roomChunkData) => {
  const normalized = normalizeRoomChunkData(roomChunkData, DEFAULT_GRID_ROWS, DEFAULT_GRID_COLS);

  return normalized.rooms.reduce((accumulator, room) => {
    accumulator[`${room.row}:${room.col}`] = room.backgroundKey;
    return accumulator;
  }, {});
};

const resolveRoomChunkData = (record, fallbackLevelNumber) => {
  const gridRows = clampDimension(record?.gridRows, DEFAULT_GRID_ROWS);
  const gridCols = clampDimension(record?.gridCols, DEFAULT_GRID_COLS);
  const storedPayload = record?.cellBackgrounds;

  if (isPlainObject(storedPayload) && Number(storedPayload.version) >= ROOM_CHUNK_SCHEMA_VERSION && Array.isArray(storedPayload.rooms)) {
    return normalizeRoomChunkData(storedPayload, gridRows, gridCols);
  }

  if (isLegacyCellBackgroundMap(storedPayload)) {
    return legacyCellBackgroundsToRoomChunkData(storedPayload, gridRows, gridCols);
  }

  return normalizeRoomChunkData({
    version: ROOM_CHUNK_SCHEMA_VERSION,
    grid: {
      rows: gridRows,
      cols: gridCols,
    },
    rooms: [
      {
        id: `room-${fallbackLevelNumber}`,
        name: `Room ${fallbackLevelNumber}`,
        row: 0,
        col: 0,
        backgroundKey: 'tutorialGrove',
        backgroundColor: DEFAULT_ROOM_BACKGROUND_COLOR,
        links: [],
        portal: {
          targetRoomId: null,
          endsLevel: true,
        },
        components: [],
        backgroundTiles: [],
      },
    ],
  }, gridRows, gridCols);
};

const resolveRoomChunkDataFromVersionPayload = (payload, fallbackLevelNumber) => {
  const parsedPayload = coerceJsonObject(payload);

  const candidateRoomChunk = isPlainObject(parsedPayload?.roomChunkData)
    ? parsedPayload.roomChunkData
    : parsedPayload;

  const payloadRows = clampDimension(
    candidateRoomChunk?.grid?.rows ?? parsedPayload?.grid?.rows,
    DEFAULT_GRID_ROWS,
  );
  const payloadCols = clampDimension(
    candidateRoomChunk?.grid?.cols ?? parsedPayload?.grid?.cols,
    DEFAULT_GRID_COLS,
  );

  if (isPlainObject(candidateRoomChunk) && Array.isArray(candidateRoomChunk.rooms)) {
    return normalizeRoomChunkData(candidateRoomChunk, payloadRows, payloadCols);
  }

  return resolveRoomChunkData(null, fallbackLevelNumber);
};

const normalizeCellBackgrounds = (cellBackgrounds, gridRows, gridCols) => {
  if (!cellBackgrounds || typeof cellBackgrounds !== 'object' || Array.isArray(cellBackgrounds)) {
    return {};
  }

  return Object.entries(cellBackgrounds).reduce((accumulator, [key, value]) => {
    if (typeof value !== 'string') {
      return accumulator;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return accumulator;
    }

    const [rowPart, colPart] = key.split(':');
    const row = Number(rowPart);
    const col = Number(colPart);

    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return accumulator;
    }

    if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) {
      return accumulator;
    }

    accumulator[`${row}:${col}`] = trimmedValue.slice(0, 40);
    return accumulator;
  }, {});
};

const toStoredVersionPayload = (roomChunkData) => ({
  schemaVersion: VERSION_PAYLOAD_SCHEMA_VERSION,
  grid: {
    rows: roomChunkData.grid.rows,
    cols: roomChunkData.grid.cols,
  },
  roomChunkData,
});

const buildCanvasPayload = ({
  levelNumber,
  legacyRecord = null,
  workspace = null,
  draftVersion = null,
  publishedVersion = null,
}) => {
  const activeVersion = draftVersion || publishedVersion;

  const roomChunkData = activeVersion
    ? resolveRoomChunkDataFromVersionPayload(activeVersion.payload, levelNumber)
    : resolveRoomChunkData(legacyRecord, levelNumber);

  const draftVersionNumber = coerceInteger(draftVersion?.versionNumber, 0) || null;
  const publishedVersionNumber = coerceInteger(publishedVersion?.versionNumber, 0) || null;
  const updatedAt = draftVersion?.createdAt
    || publishedVersion?.createdAt
    || legacyRecord?.updatedAt
    || workspace?.updatedAt
    || null;

  return {
    id: workspace?.id || legacyRecord?.id || null,
    levelNumber,
    gridRows: roomChunkData.grid.rows,
    gridCols: roomChunkData.grid.cols,
    roomChunkData,
    cellBackgrounds: roomChunkToLegacyCellBackgrounds(roomChunkData),
    updatedAt,
    versionMeta: {
      workspaceId: workspace?.id || null,
      draftVersionId: draftVersion?.id || null,
      draftVersionNumber,
      publishedVersionId: publishedVersion?.id || null,
      publishedVersionNumber,
    },
  };
};

const getLegacyTeacherLevelRecord = (teacherId, levelNumber) => prisma.teacherLevelRecord.findUnique({
  where: {
    teacherId_levelNumber: {
      teacherId,
      levelNumber,
    },
  },
});

const getTeacherWorkspace = async (teacherId, levelNumber) => {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT \`id\`, \`teacherId\`, \`gameType\`, \`levelNumber\`, \`title\`, \`createdAt\`, \`updatedAt\`
      FROM \`teacher_level_workspaces\`
      WHERE \`teacherId\` = ? AND \`gameType\` = ? AND \`levelNumber\` = ?
      LIMIT 1;
    `,
    teacherId,
    EDITOR_GAME_TYPE,
    levelNumber,
  );

  return rows[0] || null;
};

const getLatestWorkspaceVersion = async (workspaceId, state) => {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT \`id\`, \`workspaceId\`, \`state\`, \`versionNumber\`, \`payload\`, \`createdByUserId\`, \`createdAt\`
      FROM \`teacher_level_versions\`
      WHERE \`workspaceId\` = ? AND \`state\` = ?
      ORDER BY \`versionNumber\` DESC, \`createdAt\` DESC
      LIMIT 1;
    `,
    workspaceId,
    state,
  );

  return rows[0] || null;
};

const createTeacherWorkspace = async (teacherId, levelNumber) => {
  const workspaceId = randomUUID();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO \`teacher_level_workspaces\` (
        \`id\`,
        \`teacherId\`,
        \`gameType\`,
        \`levelNumber\`,
        \`title\`,
        \`createdAt\`,
        \`updatedAt\`
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3));
    `,
    workspaceId,
    teacherId,
    EDITOR_GAME_TYPE,
    levelNumber,
    `Level ${levelNumber}`,
  );

  return getTeacherWorkspace(teacherId, levelNumber);
};

const getOrCreateTeacherWorkspace = async (teacherId, levelNumber) => {
  const existingWorkspace = await getTeacherWorkspace(teacherId, levelNumber);
  if (existingWorkspace) {
    return existingWorkspace;
  }

  try {
    const createdWorkspace = await createTeacherWorkspace(teacherId, levelNumber);
    if (createdWorkspace) {
      return createdWorkspace;
    }
  } catch (error) {
    // Handle race conditions from concurrent create requests by falling back to a read.
  }

  return getTeacherWorkspace(teacherId, levelNumber);
};

const createDraftVersion = async ({ workspaceId, teacherId, roomChunkData }) => {
  const nextVersionRows = await prisma.$queryRawUnsafe(
    `
      SELECT COALESCE(MAX(\`versionNumber\`), 0) AS \`maxVersion\`
      FROM \`teacher_level_versions\`
      WHERE \`workspaceId\` = ? AND \`state\` = ?;
    `,
    workspaceId,
    VERSION_STATE_DRAFT,
  );

  const nextVersionNumber = coerceInteger(nextVersionRows?.[0]?.maxVersion, 0) + 1;
  const draftVersionId = randomUUID();
  const payload = toStoredVersionPayload(roomChunkData);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO \`teacher_level_versions\` (
        \`id\`,
        \`workspaceId\`,
        \`state\`,
        \`versionNumber\`,
        \`payload\`,
        \`createdByUserId\`,
        \`createdAt\`
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(3));
    `,
    draftVersionId,
    workspaceId,
    VERSION_STATE_DRAFT,
    nextVersionNumber,
    JSON.stringify(payload),
    teacherId,
  );

  await prisma.$executeRawUnsafe(
    `UPDATE \`teacher_level_workspaces\` SET \`updatedAt\` = NOW(3) WHERE \`id\` = ?;`,
    workspaceId,
  );

  return {
    id: draftVersionId,
    workspaceId,
    state: VERSION_STATE_DRAFT,
    versionNumber: nextVersionNumber,
    payload,
    createdByUserId: teacherId,
    createdAt: new Date(),
  };
};

const upsertLegacyTeacherLevelRecord = async (teacherId, levelNumber, roomChunkData) => prisma.teacherLevelRecord.upsert({
  where: {
    teacherId_levelNumber: {
      teacherId,
      levelNumber,
    },
  },
  create: {
    teacherId,
    levelNumber,
    gridRows: roomChunkData.grid.rows,
    gridCols: roomChunkData.grid.cols,
    cellBackgrounds: roomChunkData,
  },
  update: {
    gridRows: roomChunkData.grid.rows,
    gridCols: roomChunkData.grid.cols,
    cellBackgrounds: roomChunkData,
  },
});

const getTeacherLevelCanvas = async (teacherId, levelNumber) => {
  const parsedLevelNumber = Number(levelNumber);

  await ensureTeacherEditorTables();

  const workspace = await getTeacherWorkspace(teacherId, parsedLevelNumber);
  const [draftVersion, publishedVersion, legacyRecord] = await Promise.all([
    workspace ? getLatestWorkspaceVersion(workspace.id, VERSION_STATE_DRAFT) : Promise.resolve(null),
    workspace ? getLatestWorkspaceVersion(workspace.id, VERSION_STATE_PUBLISHED) : Promise.resolve(null),
    getLegacyTeacherLevelRecord(teacherId, parsedLevelNumber),
  ]);

  return buildCanvasPayload({
    levelNumber: parsedLevelNumber,
    legacyRecord,
    workspace,
    draftVersion,
    publishedVersion,
  });
};

const saveTeacherLevelCanvas = async (teacherId, levelNumber, payload = {}) => {
  const parsedLevelNumber = Number(levelNumber);
  const requestedGridRows = clampDimension(payload.gridRows, DEFAULT_GRID_ROWS);
  const requestedGridCols = clampDimension(payload.gridCols, DEFAULT_GRID_COLS);

  const baseRoomChunkData = isPlainObject(payload.roomChunkData)
    ? normalizeRoomChunkData(payload.roomChunkData, requestedGridRows, requestedGridCols)
    : legacyCellBackgroundsToRoomChunkData(
        normalizeCellBackgrounds(payload.cellBackgrounds, requestedGridRows, requestedGridCols),
        requestedGridRows,
        requestedGridCols,
      );

  const normalizedRoomChunkData = normalizeRoomChunkData({
    ...baseRoomChunkData,
    grid: {
      rows: requestedGridRows,
      cols: requestedGridCols,
    },
  }, requestedGridRows, requestedGridCols);

  await ensureTeacherEditorTables();

  const workspace = await getOrCreateTeacherWorkspace(teacherId, parsedLevelNumber);
  if (!workspace) {
    throw new Error('Unable to create teacher level workspace');
  }

  const [draftVersion, publishedVersion] = await Promise.all([
    createDraftVersion({
      workspaceId: workspace.id,
      teacherId,
      roomChunkData: normalizedRoomChunkData,
    }),
    getLatestWorkspaceVersion(workspace.id, VERSION_STATE_PUBLISHED),
    upsertLegacyTeacherLevelRecord(teacherId, parsedLevelNumber, normalizedRoomChunkData),
  ]);

  return buildCanvasPayload({
    levelNumber: parsedLevelNumber,
    legacyRecord: null,
    workspace,
    draftVersion,
    publishedVersion,
  });
};

const toFiniteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isGenericStatuePrompt = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'what is the correct answer?'
    || normalized === 'solve the statue riddle.';
};

const buildPlayableLevelDataFromRoomChunk = ({ teacherId, levelNumber, roomChunkData }) => {
  const normalizedChunk = normalizeRoomChunkData(
    roomChunkData,
    clampDimension(roomChunkData?.grid?.rows, DEFAULT_GRID_ROWS),
    clampDimension(roomChunkData?.grid?.cols, DEFAULT_GRID_COLS),
  );

  const orderedRooms = [...normalizedChunk.rooms].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }

    return left.col - right.col;
  });

  const viewport = {
    width: 1280,
    height: 720,
  };

  const worldObjects = {
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
  };

  const questions = [];
  const usedQuestionIds = new Set();

  const resolveUniqueQuestionId = (candidateId, fallbackBase) => {
    const baseCandidate = typeof candidateId === 'string' ? candidateId.trim().slice(0, 80) : '';
    const normalizedFallback = typeof fallbackBase === 'string' && fallbackBase.trim()
      ? fallbackBase.trim().slice(0, 80)
      : 'statue-question';
    const base = baseCandidate || normalizedFallback;

    let nextId = base;
    let suffixIndex = 2;
    while (usedQuestionIds.has(nextId)) {
      const suffix = `-${suffixIndex}`;
      nextId = `${base.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
      suffixIndex += 1;
    }

    usedQuestionIds.add(nextId);
    return nextId;
  };

  orderedRooms.forEach((room) => {
    const offsetX = toFiniteNumber(room.col, 0) * viewport.width;
    const offsetY = toFiniteNumber(room.row, 0) * viewport.height;
    const roomComponents = Array.isArray(room.components) ? room.components : [];
    const roomBackgroundTiles = Array.isArray(room.backgroundTiles) ? room.backgroundTiles : [];

    roomBackgroundTiles.forEach((tile, tileIndex) => {
      const tileKey = typeof tile.tileKey === 'string' ? tile.tileKey.trim() : '';
      if (!tileKey) {
        return;
      }

      const tileId = typeof tile.id === 'string' && tile.id.trim()
        ? tile.id.trim().slice(0, 120)
        : `tile-${tileIndex + 1}`;

      worldObjects.backgroundTiles.push({
        id: `${room.id}-${tileId}`.slice(0, 120),
        tileKey,
        x: toFiniteNumber(tile.x, 640) + offsetX,
        y: toFiniteNumber(tile.y, 360) + offsetY,
        size: clampInteger(tile.size, 16, MAX_ROOM_TILE_SIZE, DEFAULT_ROOM_TILE_SIZE),
        zIndex: clampInteger(tile.zIndex, 0, MAX_ROOM_TILE_Z_INDEX, tileIndex),
        rotationDeg: clampInteger(
          ((Math.round(Number(tile.rotationDeg) || 0) % 360) + 360) % 360,
          MIN_ROOM_TILE_ROTATION,
          MAX_ROOM_TILE_ROTATION,
          0,
        ),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
      });
    });

    roomComponents.forEach((component, index) => {
      if (component.type !== 'statue') {
        return;
      }

      const componentId = `${room.id}-${component.id || `statue-${index + 1}`}`;
      const fallbackQuestionId = `statue-${componentId}`;
      const questionId = resolveUniqueQuestionId(component.questionId, fallbackQuestionId);
      const questionTopic = typeof component.questionTopic === 'string'
        ? component.questionTopic.trim().slice(0, 140)
        : '';
      const aiDifficultyRaw = typeof component.aiDifficulty === 'string'
        ? component.aiDifficulty.trim().toLowerCase()
        : '';
      const aiDifficulty = STATUE_AI_DIFFICULTY_OPTIONS.includes(aiDifficultyRaw)
        ? aiDifficultyRaw
        : 'medium';
      const aiLanguage = typeof component.aiLanguage === 'string' && component.aiLanguage.trim()
        ? component.aiLanguage.trim().slice(0, 40)
        : DEFAULT_STATUE_AI_LANGUAGE;
      const aiGradeLevel = typeof component.aiGradeLevel === 'string'
        ? component.aiGradeLevel.trim().slice(0, 40)
        : '';
      const aiInstructions = typeof component.aiInstructions === 'string'
        ? component.aiInstructions.trim().slice(0, 500)
        : '';
      const aiChoicesCount = clampInteger(component.aiChoicesCount, 2, 6, 4);
      const teacherChoices = Array.isArray(component.choices)
        ? component.choices
          .map((choice) => (typeof choice === 'string' ? choice.trim().slice(0, 120) : ''))
          .filter(Boolean)
        : [];
      const fallbackChoices = teacherChoices.length >= 2
        ? teacherChoices
        : Array.from({ length: aiChoicesCount }, (_, choiceIndex) => `Option ${choiceIndex + 1}`);
      const rawFallbackPrompt = typeof component.prompt === 'string' && component.prompt.trim()
        ? component.prompt.trim().slice(0, 240)
        : 'Solve the statue riddle.';
      const fallbackPrompt = questionTopic && isGenericStatuePrompt(rawFallbackPrompt)
        ? `Question about ${questionTopic}`.slice(0, 240)
        : rawFallbackPrompt;
      const fallbackAnswerIndex = clampInteger(
        component.correctAnswerIndex,
        0,
        Math.max(0, fallbackChoices.length - 1),
        0,
      );

      questions.push({
        id: questionId,
        topic: questionTopic || null,
        prompt: fallbackPrompt,
        choices: fallbackChoices,
        answerIndex: fallbackAnswerIndex,
        successText: typeof component.successText === 'string' && component.successText.trim()
          ? component.successText.trim()
          : 'Correct! The statue grants your request.',
        failureText: typeof component.failureText === 'string' && component.failureText.trim()
          ? component.failureText.trim()
          : 'Not quite. Try again.',
        aiChoicesCount,
        aiDifficulty,
        aiLanguage,
        aiGradeLevel,
        aiInstructions,
      });

      worldObjects.villain.push({
        id: componentId,
        x: toFiniteNumber(component.x, 640) + offsetX,
        y: toFiniteNumber(component.y, 520) + offsetY,
        questionId,
        questionTopic,
        aiChoicesCount,
        aiDifficulty,
        aiLanguage,
        aiGradeLevel,
        aiInstructions,
        appearance: 'STATUE',
        interactionLabel: 'statue',
      });
    });
  });

  orderedRooms.forEach((room) => {
    const offsetX = toFiniteNumber(room.col, 0) * viewport.width;
    const offsetY = toFiniteNumber(room.row, 0) * viewport.height;
    const roomComponents = Array.isArray(room.components) ? room.components : [];

    roomComponents.forEach((component, index) => {
      if (component.type === 'statue') {
        return;
      }

      const componentId = `${room.id}-${component.id || `component-${index + 1}`}`;

      if (component.type === 'spawn') {
        if (!worldObjects.spawn) {
          worldObjects.spawn = {
            x: toFiniteNumber(component.x, 160) + offsetX,
            y: toFiniteNumber(component.y, 560) + offsetY,
          };
        }
        return;
      }

      if (component.type === 'platform') {
        worldObjects.platforms.push({
          id: componentId,
          x: toFiniteNumber(component.x, 640) + offsetX,
          y: toFiniteNumber(component.y, 520) + offsetY,
          width: toFiniteNumber(component.width, 220),
          bodyHeight: toFiniteNumber(component.bodyHeight, 24),
          textureKey: component.textureKey || 'grass',
        });
        return;
      }

      if (component.type === 'invisiblePlatform') {
        const height = toFiniteNumber(component.height, 36);

        worldObjects.platforms.push({
          id: componentId,
          x: toFiniteNumber(component.x, 640) + offsetX,
          y: toFiniteNumber(component.y, 520) + offsetY,
          width: toFiniteNumber(component.width, 220),
          height,
          bodyHeight: height,
          textureKey: component.textureKey || 'grass',
          invisible: true,
          passThroughSides: Array.isArray(component.passThroughSides) ? component.passThroughSides : [],
        });
        return;
      }

      if (component.type === 'coin') {
        worldObjects.coins.push({
          id: componentId,
          x: toFiniteNumber(component.x, 640) + offsetX,
          y: toFiniteNumber(component.y, 420) + offsetY,
        });
        return;
      }

      if (component.type === 'ghost') {
        const movementDirection = typeof component.movementDirection === 'string'
          ? component.movementDirection.trim().toUpperCase()
          : 'LEFT';

        worldObjects.ghosts.push({
          id: componentId,
          x: toFiniteNumber(component.x, 640) + offsetX,
          y: toFiniteNumber(component.y, 592) + offsetY,
          patrolDistance: toFiniteNumber(component.patrolDistance, 220),
          speed: toFiniteNumber(component.speed, 80),
          movementDirection: GHOST_MOVEMENT_DIRECTIONS.includes(movementDirection)
            ? movementDirection
            : 'LEFT',
        });
        return;
      }

      if (component.type === 'projectileEnemy') {
        worldObjects.projectileEnemies.push({
          id: componentId,
          enemyType: component.enemyType || 'elemental',
          x: toFiniteNumber(component.x, 920) + offsetX,
          y: toFiniteNumber(component.y, 556) + offsetY,
          fireDirection: component.fireDirection === 'RIGHT' ? 'RIGHT' : 'LEFT',
          fireIntervalMs: toFiniteNumber(component.fireIntervalMs, 1800),
          projectileSpeed: toFiniteNumber(component.projectileSpeed, 285),
          projectileLifetimeMs: toFiniteNumber(component.projectileLifetimeMs, 2550),
          initialDelayMs: toFiniteNumber(component.initialDelayMs, 900),
          hitPoints: toFiniteNumber(component.hitPoints, component.enemyType === 'boss' ? 8 : 1),
        });
        return;
      }

      if (component.type === 'barrier') {
        worldObjects.barriers.push({
          id: componentId,
          x: toFiniteNumber(component.x, 640) + offsetX,
          y: toFiniteNumber(component.y, 500) + offsetY,
          width: toFiniteNumber(component.width, 72),
          height: toFiniteNumber(component.height, 176),
          bodyHeight: toFiniteNumber(component.bodyHeight, 168),
          textureKey: component.textureKey || 'grass',
        });
        return;
      }

      if (component.type === 'portal') {
        worldObjects.portal.push({
          id: componentId,
          x: toFiniteNumber(component.x, 1135) + offsetX,
          y: toFiniteNumber(component.y, 556) + offsetY,
          locked: Boolean(component.locked),
          endsLevel: Boolean(component.endsLevel),
          linkName: typeof component.linkName === 'string' ? component.linkName.trim().slice(0, 40) : '',
        });
      }
    });

    const hasPortalComponent = roomComponents.some((component) => component.type === 'portal');
    if (!hasPortalComponent && room.portal) {
      worldObjects.portal.push({
        id: `${room.id}-legacy-portal`,
        x: offsetX + 1135,
        y: offsetY + 556,
        locked: false,
        endsLevel: room.portal.endsLevel !== false,
        linkName: '',
      });
    }
  });

  if (!worldObjects.spawn) {
    const firstRoom = orderedRooms[0] || null;
    const firstOffsetX = toFiniteNumber(firstRoom?.col, 0) * viewport.width;
    const firstOffsetY = toFiniteNumber(firstRoom?.row, 0) * viewport.height;

    worldObjects.spawn = {
      x: firstOffsetX + 160,
      y: firstOffsetY + 560,
    };
  }

  const cells = orderedRooms.length
    ? orderedRooms.map((room) => ({
        id: room.id,
        col: toFiniteNumber(room.col, 0),
        row: toFiniteNumber(room.row, 0),
        backgroundKey: typeof room.backgroundKey === 'string' && room.backgroundKey.trim()
          ? room.backgroundKey.trim().slice(0, 40)
          : 'tutorialGrove',
        backgroundColor: normalizeBackgroundColor(room.backgroundColor, DEFAULT_ROOM_BACKGROUND_COLOR),
        objective: `Explore ${room.name || room.id}`,
        postUnlockObjective: '',
      }))
    : [
        {
          id: 'room-1',
          col: 0,
          row: 0,
          backgroundKey: 'tutorialGrove',
          backgroundColor: DEFAULT_ROOM_BACKGROUND_COLOR,
          objective: 'Explore this room.',
          postUnlockObjective: '',
        },
      ];

  return {
    version: 2,
    id: `teacher-${teacherId}-level-${String(levelNumber).padStart(2, '0')}`,
    gameType: EDITOR_GAME_TYPE,
    levelNumber,
    title: `Level ${levelNumber}`,
    subtitle: 'Teacher Workspace',
    viewport,
    settings: {
      playerHealth: clampInteger(normalizedChunk.settings?.playerHealth, 1, 10, DEFAULT_LEVEL_PLAYER_HEALTH),
      timerEnabled: Boolean(normalizedChunk.settings?.timerEnabled),
      timerSeconds: clampInteger(normalizedChunk.settings?.timerSeconds, 10, 3600, DEFAULT_LEVEL_TIMER_SECONDS),
      coinGoal: clampInteger(normalizedChunk.settings?.coinGoal, 0, 999, DEFAULT_LEVEL_COIN_GOAL),
      requireBossDefeat: Boolean(normalizedChunk.settings?.requireBossDefeat),
    },
    questions,
    grid: {
      cells,
    },
    worldObjects,
  };
};

const getLatestSavedRoomChunkData = async (teacherId, levelNumber) => {
  const parsedLevelNumber = coerceInteger(levelNumber, 0);
  if (!teacherId || parsedLevelNumber <= 0) {
    return null;
  }

  await ensureTeacherEditorTables();

  const workspace = await getTeacherWorkspace(teacherId, parsedLevelNumber);
  if (workspace?.id) {
    const [draftVersion, publishedVersion] = await Promise.all([
      getLatestWorkspaceVersion(workspace.id, VERSION_STATE_DRAFT),
      getLatestWorkspaceVersion(workspace.id, VERSION_STATE_PUBLISHED),
    ]);

    const preferredVersion = draftVersion || publishedVersion;
    if (preferredVersion) {
      return resolveRoomChunkDataFromVersionPayload(preferredVersion.payload, parsedLevelNumber);
    }
  }

  const legacyRecord = await getLegacyTeacherLevelRecord(teacherId, parsedLevelNumber);
  if (legacyRecord) {
    return resolveRoomChunkData(legacyRecord, parsedLevelNumber);
  }

  return null;
};

const getTeacherSavedLevelNumbers = async (teacherId) => {
  if (!teacherId) {
    return [];
  }

  await ensureTeacherEditorTables();

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT DISTINCT
        saved.levelNumber AS levelNumber
      FROM (
        SELECT ws.levelNumber AS levelNumber
        FROM teacher_level_workspaces AS ws
        WHERE ws.teacherId = ?
          AND ws.gameType = ?
          AND EXISTS (
            SELECT 1
            FROM teacher_level_versions AS tv
            WHERE tv.workspaceId = ws.id
              AND tv.state IN (?, ?)
          )

        UNION

        SELECT tr.levelNumber AS levelNumber
        FROM teacher_level_records AS tr
        WHERE tr.teacherId = ?
      ) AS saved
      ORDER BY saved.levelNumber ASC;
    `,
    teacherId,
    EDITOR_GAME_TYPE,
    VERSION_STATE_DRAFT,
    VERSION_STATE_PUBLISHED,
    teacherId,
  );

  return rows
    .map((row) => coerceInteger(row.levelNumber, 0))
    .filter((value) => value > 0);
};

const getTeacherPlayableLevelData = async (teacherId, levelNumber) => {
  const parsedLevelNumber = coerceInteger(levelNumber, 0);
  if (!teacherId || parsedLevelNumber <= 0) {
    return null;
  }

  const roomChunkData = await getLatestSavedRoomChunkData(teacherId, parsedLevelNumber);
  if (!roomChunkData) {
    return null;
  }

  return buildPlayableLevelDataFromRoomChunk({
    teacherId,
    levelNumber: parsedLevelNumber,
    roomChunkData,
  });
};

module.exports = {
  getTeacherLevelCanvas,
  saveTeacherLevelCanvas,
  getTeacherSavedLevelNumbers,
  getTeacherPlayableLevelData,
};
