import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Brush,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Grip,
  Layers3,
  Link2,
  Loader2,
  MousePointer2,
  Pencil,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
  View,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleAPIError, teacherLevelEditorAPI } from '../utils/api';
import { gameOneRuntimeAssets } from '../games/game-one/assets/manifest/runtimeAssets';
import GameCanvas from '../games/game-one/ui/GameCanvas';
import GameOneEditorCanvas from '../features/level-editor/components/GameOneEditorCanvas';
import RoomTileEditorCanvas from '../features/level-editor/components/RoomTileEditorCanvas';
import { PLATFORM_TILE_BY_KEY, PLATFORM_TILE_CATALOG } from '../features/level-editor/platformTileCatalog';
import {
  createDefaultRoomChunkData,
  getNextRoomPosition,
  legacyCellBackgroundsToRoomChunk,
  normalizeRoomChunkData,
  roomChunkToLegacyCellBackgrounds,
} from '../features/level-editor/utils/roomChunkSchema';

const LEVEL_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);
const DOORWAY_OPTIONS = ['AUTO', 'N', 'E', 'S', 'W'];
const EDITOR_VIEWPORT = Object.freeze({ width: 1280, height: 720 });
const CANVAS_PADDING = 12;
const MAX_ROOM_COMPONENTS = 200;
const SIDEBAR_OPTIONS = Object.freeze([
  { value: 'rooms', label: 'Rooms' },
  { value: 'components', label: 'Components' },
]);
const TILE_SIDEBAR_OPTION = Object.freeze({ value: 'tiles', label: 'Tiles' });
const INSPECTOR_OPTIONS = Object.freeze([
  { value: 'levelSettings', label: 'Level Settings' },
  { value: 'config', label: 'Config' },
]);
const PALETTE_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'collectibles', label: 'Collectibles' },
  { value: 'object', label: 'Object' },
  { value: 'entity', label: 'Entity' },
  { value: 'monster', label: 'Monster' },
]);
const GHOST_DIRECTION_OPTIONS = Object.freeze(['LEFT', 'RIGHT', 'UP', 'DOWN']);
const AI_DIFFICULTY_OPTIONS = Object.freeze(['easy', 'medium', 'hard']);
const PASS_THROUGH_SIDE_OPTIONS = Object.freeze(['TOP', 'BOTTOM', 'LEFT', 'RIGHT']);
const UNBOUNDED_INVISIBLE_PLATFORM_Y_MIN = -20000;
const UNBOUNDED_INVISIBLE_PLATFORM_Y_MAX = 20000;
const DEFAULT_LEVEL_SETTINGS = Object.freeze({
  backgroundKey: 'tutorialGrove',
  playerHealth: 3,
  timerEnabled: false,
  timerSeconds: 120,
});
const TEACHER_COMPONENT_TO_EDITOR_OBJECT_TYPE = Object.freeze({
  spawn: 'spawn',
  platform: 'platforms',
  coin: 'coins',
  ghost: 'ghosts',
  projectileEnemy: 'projectileEnemies',
  barrier: 'barriers',
  portal: 'portal',
  statue: 'villain',
});
const EDITOR_OBJECT_TO_TEACHER_COMPONENT_TYPE = Object.freeze(
  Object.entries(TEACHER_COMPONENT_TO_EDITOR_OBJECT_TYPE).reduce((accumulator, [componentType, editorType]) => {
    accumulator[editorType] = componentType;
    return accumulator;
  }, {}),
);
const ROOM_EDITOR_SETTINGS = Object.freeze({
  gridSize: 20,
  snapEnabled: false,
  showGrid: true,
  showHitboxes: false,
  showGuides: true,
  showLinks: false,
  allowCameraNavigation: false,
});
const MAP_TILE_DEFAULT_SIZE = 96;
const MAP_TILE_MIN_SIZE = 24;
const MAP_TILE_MAX_SIZE = 1024;
const MAX_MAP_TILE_Z_INDEX = 9999;
const MAP_TILE_ROTATION_MIN = 0;
const MAP_TILE_ROTATION_MAX = 359;
const MAP_TILE_DEFAULT_SNAP = 32;
const MAP_TILE_SNAP_OPTIONS = Object.freeze([0, 16, 24, 32, 40, 48, 64]);
const DEFAULT_ROOM_BACKGROUND_COLOR = '#111827';
const MAP_BACKGROUND_NONE_KEY = 'none';
const MAP_TILE_SIDEBAR_SECTIONS = Object.freeze({
  TILES: 'tiles',
  CONFIG: 'config',
  SETTINGS: 'settings',
});
const MAP_TILE_CATEGORY_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'platforms', label: 'Platforms' },
  { value: 'background', label: 'Background' },
  { value: 'ground', label: 'Ground' },
  { value: 'decor', label: 'Decor' },
  { value: 'portal', label: 'Portal' },
  { value: 'mossy', label: 'Mossy' },
]);
const MAP_TILE_TOOL_MODES = Object.freeze({
  SELECT: 'select',
  PAINT: 'paint',
  ERASE: 'erase',
});
const SPRITESHEET_PREVIEW_FRAMES = Object.freeze({
  spawn: 20,
  coin: 7,
  ghost: 8,
  projectileEnemy: 8,
  portal: 4,
});
const SPRITESHEET_PREVIEW_FPS = Object.freeze({
  spawn: 8,
  coin: 12,
  ghost: 10,
  projectileEnemy: 10,
  portal: 8,
});
const COMPONENT_LIBRARY = Object.freeze([
  {
    type: 'spawn',
    label: 'Spawn Point',
    singleton: true,
    filters: ['object', 'entity'],
    create: ({ x, y }) => ({
      type: 'spawn',
      x,
      y,
    }),
  },
  {
    type: 'platform',
    label: 'Platform',
    singleton: false,
    filters: ['object'],
    create: ({ x, y, defaultTextureKey }) => ({
      type: 'platform',
      x,
      y,
      width: 220,
      bodyHeight: 24,
      textureKey: defaultTextureKey,
    }),
  },
  {
    type: 'invisiblePlatform',
    label: 'Invisible Platform',
    singleton: false,
    filters: ['object'],
    create: ({ x, y }) => ({
      type: 'invisiblePlatform',
      x,
      y,
      width: 220,
      height: 36,
      passThroughSides: [],
    }),
  },
  {
    type: 'coin',
    label: 'Coin',
    singleton: false,
    filters: ['collectibles', 'entity'],
    create: ({ x, y }) => ({
      type: 'coin',
      x,
      y,
    }),
  },
  {
    type: 'ghost',
    label: 'Ghost',
    singleton: false,
    filters: ['entity', 'monster'],
    create: ({ x, y }) => ({
      type: 'ghost',
      x,
      y,
      patrolDistance: 220,
      speed: 80,
    }),
  },
  {
    type: 'projectileEnemy',
    label: 'Projectile Enemy',
    singleton: false,
    filters: ['entity', 'monster'],
    create: ({ x, y }) => ({
      type: 'projectileEnemy',
      x,
      y,
      enemyType: 'elemental',
      fireDirection: 'LEFT',
      fireIntervalMs: 1800,
      projectileSpeed: 285,
      projectileLifetimeMs: 2550,
      initialDelayMs: 900,
    }),
  },
  {
    type: 'barrier',
    label: 'Barrier',
    singleton: false,
    filters: ['object'],
    create: ({ x, y, defaultTextureKey }) => ({
      type: 'barrier',
      x,
      y,
      width: 72,
      height: 176,
      bodyHeight: 168,
      textureKey: defaultTextureKey,
    }),
  },
  {
    type: 'portal',
    label: 'Portal',
    singleton: false,
    filters: ['object', 'entity'],
    create: ({ x, y }) => ({
      type: 'portal',
      x,
      y,
      locked: false,
      endsLevel: false,
      linkName: '',
    }),
  },
  {
    type: 'statue',
    label: 'Question Statue',
    singleton: false,
    filters: ['entity', 'object'],
    create: ({ x, y }) => ({
      type: 'statue',
      x,
      y,
      questionId: '',
      questionTopic: '',
      aiChoicesCount: 4,
      aiDifficulty: 'medium',
      aiLanguage: 'English',
      aiGradeLevel: '',
      aiInstructions: '',
      prompt: 'What is the correct answer?',
      choices: ['A', 'B', 'C', 'D'],
      correctAnswerIndex: 0,
      successText: 'Correct! The statue grants your request.',
      failureText: 'Not quite. Try again.',
    }),
  },
]);

const toDisplayLabel = (value) => value
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const formatTimestamp = (value) => {
  if (!value) {
    return 'Not saved yet';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeMapTileZIndex = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return clampNumber(fallback, 0, MAX_MAP_TILE_Z_INDEX);
  }

  return clampNumber(Math.round(parsed), 0, MAX_MAP_TILE_Z_INDEX);
};

const normalizeMapTileRotation = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return clampNumber(fallback, MAP_TILE_ROTATION_MIN, MAP_TILE_ROTATION_MAX);
  }

  const rounded = Math.round(parsed);
  const normalized = ((rounded % 360) + 360) % 360;
  return clampNumber(normalized, MAP_TILE_ROTATION_MIN, MAP_TILE_ROTATION_MAX);
};

const toTileBlendMode = (value) => (String(value || '').trim().toLowerCase() === 'screen' ? 'screen' : 'normal');

const toMapTileCategory = (tile) => {
  const source = String(tile?.source || '').trim().toLowerCase();
  const group = String(tile?.group || '').trim().toLowerCase();
  const label = String(tile?.label || '').trim().toLowerCase();
  const path = String(tile?.path || '').trim().toLowerCase();
  const joined = `${group} ${label} ${path}`;

  if (tile?.isPortalTile || joined.includes('portal')) {
    return 'portal';
  }

  if (source === 'mossy') {
    if (joined.includes('background')) {
      return 'background';
    }

    if (
      joined.includes('decor')
      || joined.includes('decoration')
      || joined.includes('hazard')
      || joined.includes('hanging')
      || joined.includes('plant')
    ) {
      return 'decor';
    }

    if (joined.includes('ground') || joined.includes('tile set') || joined.includes('tileset')) {
      return 'ground';
    }

    return 'mossy';
  }

  if (joined.includes('background')) {
    return 'background';
  }

  if (joined.includes('ground') || joined.includes('floor') || joined.includes('land')) {
    return 'ground';
  }

  if (joined.includes('decor') || joined.includes('decoration') || joined.includes('detail') || joined.includes('plant')) {
    return 'decor';
  }

  return 'platforms';
};

const sortMapTilesByLayer = (tiles = []) => (Array.isArray(tiles)
  ? [...tiles]
    .map((tile, index) => ({
      tile,
      index,
      zIndex: normalizeMapTileZIndex(tile?.zIndex, index),
    }))
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex) {
        return left.zIndex - right.zIndex;
      }

      return left.index - right.index;
    })
    .map(({ tile }) => tile)
  : []);

const remapMapTileLayerIndexes = (tiles = []) => sortMapTilesByLayer(tiles)
  .map((tile, index) => ({
    ...tile,
    zIndex: index,
  }));

const toRuntimeBackgroundTileTextureKey = (roomId, tileId, index) => {
  const safeRoom = typeof roomId === 'string' && roomId.trim() ? roomId.trim() : 'room';
  const safeTile = typeof tileId === 'string' && tileId.trim() ? tileId.trim() : `tile-${index + 1}`;
  return `room-bg-${safeRoom}-${safeTile}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
};

const EntityThumbnail = ({
  componentType,
  textureKey = '',
  resolveComponentVisual,
  animated = false,
  className = '',
}) => {
  if (componentType === 'invisiblePlatform') {
    return (
      <div className={`flex h-11 w-11 items-center justify-center rounded-md border border-slate-600 bg-slate-800 ${className}`}>
        <div className="h-6 w-8 rounded-sm border-2 border-cyan-300/90 bg-transparent" />
      </div>
    );
  }

  const visual = resolveComponentVisual(componentType, textureKey);
  const frameCount = visual?.isSheet ? (SPRITESHEET_PREVIEW_FRAMES[componentType] || 1) : 1;
  const frameRate = SPRITESHEET_PREVIEW_FPS[componentType] || 8;
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!animated || !visual?.isSheet || frameCount <= 1 || typeof window === 'undefined') {
      setFrameIndex(0);
      return undefined;
    }

    const intervalMs = Math.max(60, Math.floor(1000 / frameRate));
    const timer = window.setInterval(() => {
      setFrameIndex((previous) => (previous + 1) % frameCount);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [animated, frameCount, frameRate, visual?.isSheet, visual?.url]);

  if (!visual?.url) {
    return (
      <div className={`flex h-11 w-11 items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-[10px] font-bold text-slate-400 ${className}`}>
        N/A
      </div>
    );
  }

  if (!visual.isSheet) {
    return (
      <div className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-slate-600 bg-slate-800 ${className}`}>
        <img
          src={visual.url}
          alt={`${componentType} preview`}
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  const frameWidth = Number(visual.frameConfig?.frameWidth) || 40;
  const frameHeight = Number(visual.frameConfig?.frameHeight) || 40;
  const previewHeight = 38;
  const previewWidth = Math.max(14, Math.round((frameWidth / frameHeight) * previewHeight));

  return (
    <div className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-slate-600 bg-slate-800 ${className}`}>
      <div className="overflow-hidden" style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}>
        <img
          src={visual.url}
          alt={`${componentType} preview`}
          draggable={false}
          className="max-w-none"
          style={{
            width: `${previewWidth * frameCount}px`,
            height: `${previewHeight}px`,
            transform: `translateX(-${frameIndex * previewWidth}px)`,
          }}
        />
      </div>
    </div>
  );
};

const TeacherLevelEditorPage = () => {
  const navigate = useNavigate();
  const canvasHostRef = useRef(null);

  const [selectedLevel, setSelectedLevel] = useState(1);
  const [roomChunkData, setRoomChunkData] = useState(createDefaultRoomChunkData());
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [activeBackground, setActiveBackground] = useState('tutorialGrove');
  const [linkDraftTargetId, setLinkDraftTargetId] = useState('');
  const [previewRunNonce, setPreviewRunNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLiveEngineEnabled, setIsLiveEngineEnabled] = useState(false);
  const [workspaceEditMode, setWorkspaceEditMode] = useState('components');
  const [leftSidebarMode, setLeftSidebarMode] = useState('rooms');
  const [isRoomsPanelOpen, setIsRoomsPanelOpen] = useState(false);
  const [isInspectorPanelOpen, setIsInspectorPanelOpen] = useState(false);
  const [inspectorMode, setInspectorMode] = useState('levelSettings');
  const [paletteFilter, setPaletteFilter] = useState('all');
  const [selectedMapTileKey, setSelectedMapTileKey] = useState('');
  const [mapTileSize, setMapTileSize] = useState(MAP_TILE_DEFAULT_SIZE);
  const [mapTileRotationDeg, setMapTileRotationDeg] = useState(0);
  const [mapTileFlipX, setMapTileFlipX] = useState(false);
  const [mapTileFlipY, setMapTileFlipY] = useState(false);
  const [mapTileSnap, setMapTileSnap] = useState(MAP_TILE_DEFAULT_SNAP);
  const [mapTileCategoryFilter, setMapTileCategoryFilter] = useState('all');
  const [mapTileInspectorSection, setMapTileInspectorSection] = useState(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
  const [mapTileToolMode, setMapTileToolMode] = useState(MAP_TILE_TOOL_MODES.SELECT);
  const [selectedMapPlacedTileId, setSelectedMapPlacedTileId] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [canvasBounds, setCanvasBounds] = useState({ width: 1280, height: 720 });
  const [canvasMeta, setCanvasMeta] = useState({
    id: null,
    updatedAt: null,
  });

  const rooms = roomChunkData.rooms || [];

  const roomLookup = useMemo(
    () => Object.fromEntries(rooms.map((room) => [room.id, room])),
    [rooms],
  );

  const selectedRoom = selectedRoomId ? roomLookup[selectedRoomId] : null;
  const selectedRoomIndex = useMemo(
    () => rooms.findIndex((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId],
  );

  const availableLinkTargets = useMemo(
    () => rooms.filter((room) => room.id !== selectedRoomId),
    [rooms, selectedRoomId],
  );

  const selectedRoomLinks = Array.isArray(selectedRoom?.links) ? selectedRoom.links : [];
  const selectedRoomComponents = Array.isArray(selectedRoom?.components) ? selectedRoom.components : [];
  const selectedRoomBackgroundTiles = Array.isArray(selectedRoom?.backgroundTiles)
    ? selectedRoom.backgroundTiles
    : [];
  const selectedRoomBackgroundColor = typeof selectedRoom?.backgroundColor === 'string' && selectedRoom.backgroundColor
    ? selectedRoom.backgroundColor
    : DEFAULT_ROOM_BACKGROUND_COLOR;
  const selectedMapPlacedTile = useMemo(
    () => selectedRoomBackgroundTiles.find((tile) => tile.id === selectedMapPlacedTileId) || null,
    [selectedMapPlacedTileId, selectedRoomBackgroundTiles],
  );
  const mapTileSizeSliderValue = useMemo(() => {
    if (selectedMapPlacedTile) {
      return clampNumber(Number(selectedMapPlacedTile.size) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE);
    }

    return clampNumber(Number(mapTileSize) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE);
  }, [mapTileSize, selectedMapPlacedTile]);
  const mapTileRotationSliderValue = useMemo(() => {
    if (selectedMapPlacedTile) {
      return normalizeMapTileRotation(selectedMapPlacedTile.rotationDeg, 0);
    }

    return normalizeMapTileRotation(mapTileRotationDeg, 0);
  }, [mapTileRotationDeg, selectedMapPlacedTile]);
  const mapTileFlipXValue = selectedMapPlacedTile
    ? Boolean(selectedMapPlacedTile.flipX)
    : Boolean(mapTileFlipX);
  const mapTileFlipYValue = selectedMapPlacedTile
    ? Boolean(selectedMapPlacedTile.flipY)
    : Boolean(mapTileFlipY);
  const selectedComponent = useMemo(
    () => selectedRoomComponents.find((component) => component.id === selectedComponentId) || null,
    [selectedComponentId, selectedRoomComponents],
  );
  const levelSettings = useMemo(() => {
    const settings = roomChunkData?.settings || {};
    return {
      backgroundKey: typeof settings.backgroundKey === 'string' && settings.backgroundKey.trim()
        ? settings.backgroundKey.trim()
        : DEFAULT_LEVEL_SETTINGS.backgroundKey,
      playerHealth: clampNumber(Number(settings.playerHealth) || DEFAULT_LEVEL_SETTINGS.playerHealth, 1, 10),
      timerEnabled: Boolean(settings.timerEnabled),
      timerSeconds: clampNumber(Number(settings.timerSeconds) || DEFAULT_LEVEL_SETTINGS.timerSeconds, 10, 3600),
    };
  }, [roomChunkData?.settings]);
  const selectedPortalNameCount = useMemo(() => {
    if (selectedComponent?.type !== 'portal') {
      return 0;
    }

    const normalizedName = typeof selectedComponent.linkName === 'string'
      ? selectedComponent.linkName.trim()
      : '';

    if (!normalizedName) {
      return 0;
    }

    return rooms.reduce((count, room) => {
      const roomComponents = Array.isArray(room.components) ? room.components : [];
      return count + roomComponents.filter((component) => (
        component.type === 'portal'
        && typeof component.linkName === 'string'
        && component.linkName.trim() === normalizedName
      )).length;
    }, 0);
  }, [rooms, selectedComponent]);
  const componentConfigByType = useMemo(
    () => Object.fromEntries(COMPONENT_LIBRARY.map((component) => [component.type, component])),
    [],
  );
  const filteredComponentLibrary = useMemo(() => {
    if (paletteFilter === 'all') {
      return COMPONENT_LIBRARY;
    }

    return COMPONENT_LIBRARY.filter((component) => Array.isArray(component.filters) && component.filters.includes(paletteFilter));
  }, [paletteFilter]);
  const selectedMapTile = useMemo(() => {
    if (!selectedMapTileKey) {
      return null;
    }

    return PLATFORM_TILE_BY_KEY[selectedMapTileKey] || null;
  }, [selectedMapTileKey]);
  const isPlayMode = isLiveEngineEnabled;
  const isMapTilePaintMode = mapTileToolMode === MAP_TILE_TOOL_MODES.PAINT;
  const isMapTileEraseMode = mapTileToolMode === MAP_TILE_TOOL_MODES.ERASE;
  const isMapTileSidebarAvailable = workspaceEditMode === 'mapTiles' && !isPlayMode;
  const leftSidebarOptions = useMemo(() => (
    isMapTileSidebarAvailable
      ? [...SIDEBAR_OPTIONS, TILE_SIDEBAR_OPTION]
      : SIDEBAR_OPTIONS
  ), [isMapTileSidebarAvailable]);
  const groupedMapTiles = useMemo(() => PLATFORM_TILE_CATALOG
    .filter((tile) => (
      mapTileCategoryFilter === 'all'
      || (mapTileCategoryFilter === 'mossy' && tile.source === 'mossy')
      || toMapTileCategory(tile) === mapTileCategoryFilter
    ))
    .reduce((accumulator, tile) => {
    const currentGroup = tile.group || 'General';
    if (!accumulator[currentGroup]) {
      accumulator[currentGroup] = [];
    }
    accumulator[currentGroup].push(tile);
    return accumulator;
  }, {}), [mapTileCategoryFilter]);

  const runtimeImageByKey = useMemo(
    () => Object.fromEntries(gameOneRuntimeAssets.images.map((entry) => [entry.key, entry.url])),
    [],
  );

  const runtimeSpritesheetByKey = useMemo(
    () => Object.fromEntries(gameOneRuntimeAssets.spritesheets.map((entry) => [entry.key, {
      url: entry.url,
      frameConfig: entry.frameConfig,
    }])),
    [],
  );

  const defaultPlatformTextureKey = useMemo(() => {
    const keys = Object.keys(gameOneRuntimeAssets.manifest?.platforms || {});
    return keys[0] || 'grass';
  }, []);

  const backgroundOptions = useMemo(() => {
    const manifestBackgrounds = gameOneRuntimeAssets.manifest?.backgrounds || {};
    const imageLookup = Object.fromEntries(
      gameOneRuntimeAssets.images.map((entry) => [entry.key, entry.url]),
    );

    const options = Object.entries(manifestBackgrounds).map(([backgroundKey, config]) => ({
      value: backgroundKey,
      label: toDisplayLabel(backgroundKey),
      imageUrl: imageLookup[config.key] || null,
    }));

    const withNoneOption = [
      {
        value: MAP_BACKGROUND_NONE_KEY,
        label: 'None (Color only)',
        imageUrl: null,
      },
      ...options,
    ];

    if (withNoneOption.length <= 1) {
      return [
        {
          value: MAP_BACKGROUND_NONE_KEY,
          label: 'None (Color only)',
          imageUrl: null,
        },
        { value: 'tutorialGrove', label: 'Tutorial Grove', imageUrl: null },
      ];
    }

    return withNoneOption;
  }, []);

  const backgroundByValue = useMemo(
    () => Object.fromEntries(backgroundOptions.map((option) => [option.value, option])),
    [backgroundOptions],
  );
  const selectedRoomBackgroundImage = backgroundByValue[selectedRoom?.backgroundKey || activeBackground]?.imageUrl || null;
  const selectedRoomBackgroundTilesResolved = useMemo(() => sortMapTilesByLayer(selectedRoomBackgroundTiles)
    .map((tile, index) => {
      const visual = PLATFORM_TILE_BY_KEY[tile.tileKey];
      if (!visual?.url) {
        return null;
      }

      return {
        ...tile,
        zIndex: normalizeMapTileZIndex(tile.zIndex, index),
        rotationDeg: normalizeMapTileRotation(tile.rotationDeg, 0),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
        blendMode: toTileBlendMode(visual.blendMode),
        url: visual.url,
        label: visual.label,
      };
    })
    .filter(Boolean), [selectedRoomBackgroundTiles]);

  const resolveComponentVisual = useCallback((componentType, textureKey) => {
    const manifest = gameOneRuntimeAssets.manifest || {};

    const resolveSpriteSheet = (key) => {
      const sheet = runtimeSpritesheetByKey[key];
      if (!sheet?.url) {
        return null;
      }
      return {
        url: sheet.url,
        isSheet: true,
        frameConfig: sheet.frameConfig || null,
      };
    };

    const resolveImage = (key) => {
      const url = runtimeImageByKey[key];
      if (!url) {
        return null;
      }
      return {
        url,
        isSheet: false,
        frameConfig: null,
      };
    };

    if (componentType === 'spawn') {
      return resolveSpriteSheet(manifest.player?.key);
    }

    if (componentType === 'coin') {
      return resolveSpriteSheet(manifest.coin?.key);
    }

    if (componentType === 'ghost') {
      return resolveSpriteSheet(manifest.ghost?.key);
    }

    if (componentType === 'projectileEnemy') {
      return resolveSpriteSheet(manifest.projectileCaster?.key);
    }

    if (componentType === 'portal') {
      return resolveSpriteSheet(manifest.portal?.key);
    }

    if (componentType === 'statue') {
      return resolveImage(manifest.villain?.key);
    }

    if (componentType === 'platform' || componentType === 'barrier' || componentType === 'invisiblePlatform') {
      const requestedTexture = typeof textureKey === 'string' ? textureKey.trim() : '';
      const fallbackTexture = componentType === 'barrier' ? 'stone' : defaultPlatformTextureKey;
      const selectedTexture = requestedTexture && manifest.platforms?.[requestedTexture]
        ? requestedTexture
        : fallbackTexture;

      const imageKey = manifest.platforms?.[selectedTexture]?.key;
      return resolveImage(imageKey);
    }

    return null;
  }, [defaultPlatformTextureKey, runtimeImageByKey, runtimeSpritesheetByKey]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) {
      return undefined;
    }

    const syncBounds = () => {
      setCanvasBounds({
        width: Math.max(1, Math.floor(host.clientWidth)),
        height: Math.max(1, Math.floor(host.clientHeight)),
      });
    };

    syncBounds();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(syncBounds);
      observer.observe(host);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', syncBounds);
    return () => window.removeEventListener('resize', syncBounds);
  }, []);

  const fittedCanvasSize = useMemo(() => {
    const ratio = EDITOR_VIEWPORT.width / EDITOR_VIEWPORT.height;
    const maxWidth = Math.max(1, canvasBounds.width - CANVAS_PADDING);
    const maxHeight = Math.max(1, canvasBounds.height - CANVAS_PADDING);

    let width = maxWidth;
    let height = Math.floor(width / ratio);

    if (height > maxHeight) {
      height = maxHeight;
      width = Math.floor(height * ratio);
    }

    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }, [canvasBounds.height, canvasBounds.width]);

  const previewLevelData = useMemo(() => {
    const orderedRooms = [...rooms].sort((a, b) => {
      if (a.row !== b.row) {
        return a.row - b.row;
      }
      return a.col - b.col;
    });

    const fallbackRoom = selectedRoom || orderedRooms[0] || null;
    const fallbackOffsetX = Number(fallbackRoom?.col || 0) * EDITOR_VIEWPORT.width;
    const fallbackOffsetY = Number(fallbackRoom?.row || 0) * EDITOR_VIEWPORT.height;

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

    const previewQuestions = [];
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
      const offsetX = Number(room.col || 0) * EDITOR_VIEWPORT.width;
      const offsetY = Number(room.row || 0) * EDITOR_VIEWPORT.height;
      const roomComponents = Array.isArray(room.components) ? room.components : [];

      roomComponents.forEach((component, index) => {
        if (component.type !== 'statue') {
          return;
        }

        const componentId = `${room.id}-${component.id || `statue-${index + 1}`}`;
        const fallbackQuestionId = `statue-${componentId}`;
        const questionId = resolveUniqueQuestionId(component.questionId, fallbackQuestionId);
        const questionTopic = typeof component.questionTopic === 'string' ? component.questionTopic.trim().slice(0, 140) : '';
        const aiDifficultyRaw = typeof component.aiDifficulty === 'string' ? component.aiDifficulty.trim().toLowerCase() : '';
        const aiDifficulty = AI_DIFFICULTY_OPTIONS.includes(aiDifficultyRaw) ? aiDifficultyRaw : 'medium';
        const aiLanguage = typeof component.aiLanguage === 'string' && component.aiLanguage.trim()
          ? component.aiLanguage.trim().slice(0, 40)
          : 'English';
        const aiGradeLevel = typeof component.aiGradeLevel === 'string'
          ? component.aiGradeLevel.trim().slice(0, 40)
          : '';
        const aiInstructions = typeof component.aiInstructions === 'string'
          ? component.aiInstructions.trim().slice(0, 500)
          : '';
        const aiChoicesCount = clampNumber(Number(component.aiChoicesCount) || 4, 2, 6);
        const fallbackChoices = Array.from({ length: aiChoicesCount }, (_, choiceIndex) => `Option ${choiceIndex + 1}`);

        previewQuestions.push({
          id: questionId,
          topic: questionTopic || null,
          prompt: 'Solve the statue riddle.',
          choices: fallbackChoices,
          answerIndex: 0,
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
          x: (Number(component.x) || 640) + offsetX,
          y: (Number(component.y) || 520) + offsetY,
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

    const selectedRoomSpawn = selectedRoomComponents.find((component) => component.type === 'spawn');
    if (selectedRoomSpawn) {
      worldObjects.spawn = {
        x: (Number(selectedRoomSpawn.x) || 160) + fallbackOffsetX,
        y: (Number(selectedRoomSpawn.y) || 560) + fallbackOffsetY,
      };
    }

    orderedRooms.forEach((room) => {
      const offsetX = Number(room.col || 0) * EDITOR_VIEWPORT.width;
      const offsetY = Number(room.row || 0) * EDITOR_VIEWPORT.height;
      const roomComponents = Array.isArray(room.components) ? room.components : [];
      const roomBackgroundTiles = sortMapTilesByLayer(room.backgroundTiles);

      roomBackgroundTiles.forEach((tile, tileIndex) => {
        const visual = PLATFORM_TILE_BY_KEY[tile.tileKey];
        if (!visual?.url) {
          return;
        }

        const tileId = typeof tile.id === 'string' && tile.id.trim()
          ? tile.id.trim().slice(0, 120)
          : `tile-${tileIndex + 1}`;
        const textureKey = toRuntimeBackgroundTileTextureKey(room.id, tileId, tileIndex);

        worldObjects.backgroundTiles.push({
          id: `${room.id}-${tileId}`.slice(0, 120),
          tileKey: tile.tileKey,
          textureKey,
          imageUrl: visual.url,
          x: clampNumber((Number(tile.x) || 640) + offsetX, 0, EDITOR_VIEWPORT.width * 80),
          y: clampNumber((Number(tile.y) || 360) + offsetY, 0, EDITOR_VIEWPORT.height * 80),
          size: clampNumber(Number(tile.size) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE),
          zIndex: normalizeMapTileZIndex(tile.zIndex, tileIndex),
          rotationDeg: normalizeMapTileRotation(tile.rotationDeg, 0),
          flipX: Boolean(tile.flipX),
          flipY: Boolean(tile.flipY),
          blendMode: toTileBlendMode(visual.blendMode),
        });
      });

      roomComponents.forEach((component, index) => {
        if (component.type === 'statue') {
          return;
        }

        const componentId = `${room.id}-${component.id || `component-${index + 1}`}`;

        if (component.type === 'spawn') {
          if (!worldObjects.spawn) {
            worldObjects.spawn = {
              x: (Number(component.x) || 160) + offsetX,
              y: (Number(component.y) || 560) + offsetY,
            };
          }
          return;
        }

        if (component.type === 'platform') {
          worldObjects.platforms.push({
            id: componentId,
            x: (Number(component.x) || 640) + offsetX,
            y: (Number(component.y) || 520) + offsetY,
            width: Number(component.width) || 220,
            bodyHeight: Number(component.bodyHeight) || 24,
            textureKey: component.textureKey || defaultPlatformTextureKey,
          });
          return;
        }

        if (component.type === 'invisiblePlatform') {
          worldObjects.platforms.push({
            id: componentId,
            x: (Number(component.x) || 640) + offsetX,
            y: (Number(component.y) || 520) + offsetY,
            width: Number(component.width) || 220,
            height: Number(component.height) || 36,
            bodyHeight: Number(component.height) || 36,
            textureKey: component.textureKey || defaultPlatformTextureKey,
            invisible: true,
            passThroughSides: Array.isArray(component.passThroughSides)
              ? component.passThroughSides
              : [],
          });
          return;
        }

        if (component.type === 'coin') {
          worldObjects.coins.push({
            id: componentId,
            x: (Number(component.x) || 640) + offsetX,
            y: (Number(component.y) || 420) + offsetY,
          });
          return;
        }

        if (component.type === 'ghost') {
          worldObjects.ghosts.push({
            id: componentId,
            x: (Number(component.x) || 640) + offsetX,
            y: (Number(component.y) || 592) + offsetY,
            patrolDistance: Number(component.patrolDistance) || 220,
            speed: Number(component.speed) || 80,
            movementDirection: GHOST_DIRECTION_OPTIONS.includes(
              typeof component.movementDirection === 'string' ? component.movementDirection.toUpperCase() : '',
            )
              ? component.movementDirection.toUpperCase()
              : 'LEFT',
          });
          return;
        }

        if (component.type === 'projectileEnemy') {
          worldObjects.projectileEnemies.push({
            id: componentId,
            enemyType: component.enemyType || 'elemental',
            x: (Number(component.x) || 920) + offsetX,
            y: (Number(component.y) || 556) + offsetY,
            fireDirection: component.fireDirection === 'RIGHT' ? 'RIGHT' : 'LEFT',
            fireIntervalMs: Number(component.fireIntervalMs) || 1800,
            projectileSpeed: Number(component.projectileSpeed) || 285,
            projectileLifetimeMs: Number(component.projectileLifetimeMs) || 2550,
            initialDelayMs: Number(component.initialDelayMs) || 900,
          });
          return;
        }

        if (component.type === 'barrier') {
          worldObjects.barriers.push({
            id: componentId,
            x: (Number(component.x) || 640) + offsetX,
            y: (Number(component.y) || 500) + offsetY,
            width: Number(component.width) || 72,
            height: Number(component.height) || 176,
            bodyHeight: Number(component.bodyHeight) || 168,
            textureKey: component.textureKey || defaultPlatformTextureKey,
          });
          return;
        }

        if (component.type === 'portal') {
          worldObjects.portal.push({
            id: componentId,
            x: (Number(component.x) || 1135) + offsetX,
            y: (Number(component.y) || 556) + offsetY,
            locked: Boolean(component.locked),
            endsLevel: Boolean(component.endsLevel),
            linkName: typeof component.linkName === 'string' ? component.linkName.trim().slice(0, 40) : '',
          });
          return;
        }
      });

      if (!roomComponents.some((component) => component.type === 'portal') && room.portal) {
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
      worldObjects.spawn = {
        x: fallbackOffsetX + 160,
        y: fallbackOffsetY + 560,
      };
    }

    const previewCells = orderedRooms.length
      ? orderedRooms.map((room) => ({
          id: room.id,
          col: Number(room.col || 0),
          row: Number(room.row || 0),
          backgroundKey: room.backgroundKey || activeBackground,
          backgroundColor: room.backgroundColor || DEFAULT_ROOM_BACKGROUND_COLOR,
          objective: `Previewing ${room.name || room.id}`,
          postUnlockObjective: '',
        }))
      : [
          {
            id: selectedRoom?.id || 'room-1',
            col: 0,
            row: 0,
            backgroundKey: selectedRoom?.backgroundKey || activeBackground,
            backgroundColor: selectedRoom?.backgroundColor || DEFAULT_ROOM_BACKGROUND_COLOR,
            objective: `Previewing ${selectedRoom?.name || 'room'}`,
            postUnlockObjective: '',
          },
        ];

    return {
      version: 2,
      id: `teacher-preview-${selectedLevel}-${selectedRoom?.id || 'room'}`,
      gameType: 'GAME_ONE',
      levelNumber: Number(selectedLevel) || 1,
      title: selectedRoom?.name || `Level ${selectedLevel}`,
      subtitle: 'Teacher Workspace Preview',
      viewport: { ...EDITOR_VIEWPORT },
      settings: {
        playerHealth: levelSettings.playerHealth,
        timerEnabled: levelSettings.timerEnabled,
        timerSeconds: levelSettings.timerSeconds,
      },
      questions: previewQuestions,
      grid: {
        cells: previewCells,
      },
      worldObjects,
    };
  }, [activeBackground, defaultPlatformTextureKey, levelSettings.playerHealth, levelSettings.timerEnabled, levelSettings.timerSeconds, rooms, selectedLevel, selectedRoom, selectedRoomComponents]);

  const roomEditorLevelData = useMemo(() => {
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

    sortMapTilesByLayer(selectedRoomBackgroundTiles).forEach((tile, tileIndex) => {
      const visual = PLATFORM_TILE_BY_KEY[tile.tileKey];
      if (!visual?.url) {
        return;
      }

      const tileId = typeof tile.id === 'string' && tile.id.trim()
        ? tile.id.trim().slice(0, 120)
        : `tile-${tileIndex + 1}`;

      worldObjects.backgroundTiles.push({
        id: tileId,
        tileKey: tile.tileKey,
        textureKey: toRuntimeBackgroundTileTextureKey(selectedRoom?.id || 'room-1', tileId, tileIndex),
        imageUrl: visual.url,
        x: clampNumber(Number(tile.x) || 640, 0, EDITOR_VIEWPORT.width),
        y: clampNumber(Number(tile.y) || 360, 0, EDITOR_VIEWPORT.height),
        size: clampNumber(Number(tile.size) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE),
        zIndex: normalizeMapTileZIndex(tile.zIndex, tileIndex),
        rotationDeg: normalizeMapTileRotation(tile.rotationDeg, 0),
        flipX: Boolean(tile.flipX),
        flipY: Boolean(tile.flipY),
        blendMode: toTileBlendMode(visual.blendMode),
      });
    });

    selectedRoomComponents.forEach((component, index) => {
      const editorId = component.id || `cmp-${component.type}-${index + 1}`;

      if (component.type === 'spawn') {
        worldObjects.spawn = {
          _editorId: editorId,
          x: Number(component.x) || 160,
          y: Number(component.y) || 560,
        };
        return;
      }

      if (component.type === 'platform') {
        worldObjects.platforms.push({
          _editorId: editorId,
          id: component.id || `platform-${index + 1}`,
          x: Number(component.x) || 640,
          y: Number(component.y) || 520,
          width: Number(component.width) || 220,
          bodyHeight: Number(component.bodyHeight) || 24,
          textureKey: component.textureKey || defaultPlatformTextureKey,
        });
        return;
      }

      if (component.type === 'invisiblePlatform') {
        worldObjects.barriers.push({
          _editorId: editorId,
          id: component.id || `invisible-platform-${index + 1}`,
          x: Number(component.x) || 640,
          y: Number(component.y) || 520,
          width: Number(component.width) || 220,
          height: Number(component.height) || 36,
          bodyHeight: Number(component.height) || 36,
          textureKey: component.textureKey || defaultPlatformTextureKey,
          invisible: true,
          passThroughSides: Array.isArray(component.passThroughSides)
            ? component.passThroughSides
            : [],
        });
        return;
      }

      if (component.type === 'coin') {
        worldObjects.coins.push({
          _editorId: editorId,
          id: component.id || `coin-${index + 1}`,
          x: Number(component.x) || 640,
          y: Number(component.y) || 420,
        });
        return;
      }

      if (component.type === 'ghost') {
        worldObjects.ghosts.push({
          _editorId: editorId,
          id: component.id || `ghost-${index + 1}`,
          x: Number(component.x) || 640,
          y: Number(component.y) || 592,
          patrolDistance: Number(component.patrolDistance) || 220,
          speed: Number(component.speed) || 80,
          movementDirection: GHOST_DIRECTION_OPTIONS.includes(
            typeof component.movementDirection === 'string' ? component.movementDirection.toUpperCase() : '',
          )
            ? component.movementDirection.toUpperCase()
            : 'LEFT',
        });
        return;
      }

      if (component.type === 'projectileEnemy') {
        worldObjects.projectileEnemies.push({
          _editorId: editorId,
          id: component.id || `projectile-enemy-${index + 1}`,
          enemyType: component.enemyType || 'elemental',
          x: Number(component.x) || 920,
          y: Number(component.y) || 556,
          fireDirection: component.fireDirection === 'RIGHT' ? 'RIGHT' : 'LEFT',
          fireIntervalMs: Number(component.fireIntervalMs) || 1800,
          projectileSpeed: Number(component.projectileSpeed) || 285,
          projectileLifetimeMs: Number(component.projectileLifetimeMs) || 2550,
          initialDelayMs: Number(component.initialDelayMs) || 900,
        });
        return;
      }

      if (component.type === 'barrier') {
        worldObjects.barriers.push({
          _editorId: editorId,
          id: component.id || `barrier-${index + 1}`,
          x: Number(component.x) || 640,
          y: Number(component.y) || 500,
          width: Number(component.width) || 72,
          height: Number(component.height) || 176,
          bodyHeight: Number(component.bodyHeight) || 168,
          textureKey: component.textureKey || defaultPlatformTextureKey,
        });
        return;
      }

      if (component.type === 'portal') {
        worldObjects.portal.push({
          _editorId: editorId,
          id: component.id || `portal-${index + 1}`,
          x: Number(component.x) || 1135,
          y: Number(component.y) || 556,
          locked: Boolean(component.locked),
          endsLevel: Boolean(component.endsLevel),
          linkName: typeof component.linkName === 'string' ? component.linkName.trim().slice(0, 40) : '',
        });
        return;
      }

      if (component.type === 'statue') {
        worldObjects.villain.push({
          _editorId: editorId,
          x: Number(component.x) || 640,
          y: Number(component.y) || 520,
          questionId: typeof component.questionId === 'string'
            ? component.questionId
            : '',
          questionTopic: typeof component.questionTopic === 'string'
            ? component.questionTopic
            : '',
          aiChoicesCount: clampNumber(Number(component.aiChoicesCount) || 4, 2, 6),
          aiDifficulty: typeof component.aiDifficulty === 'string' ? component.aiDifficulty : 'medium',
          aiLanguage: typeof component.aiLanguage === 'string' && component.aiLanguage.trim()
            ? component.aiLanguage.trim().slice(0, 40)
            : 'English',
          aiGradeLevel: typeof component.aiGradeLevel === 'string'
            ? component.aiGradeLevel.trim().slice(0, 40)
            : '',
          aiInstructions: typeof component.aiInstructions === 'string'
            ? component.aiInstructions.trim().slice(0, 500)
            : '',
          appearance: 'STATUE',
          interactionLabel: 'statue',
        });
      }
    });

    return {
      version: 2,
      id: `teacher-room-editor-${selectedLevel}-${selectedRoom?.id || 'room'}`,
      gameType: 'GAME_ONE',
      levelNumber: Number(selectedLevel) || 1,
      title: selectedRoom?.name || `Level ${selectedLevel}`,
      subtitle: 'Teacher Room Entity Editor',
      viewport: { ...EDITOR_VIEWPORT },
      questions: [],
      grid: {
        cells: [
          {
            id: selectedRoom?.id || 'room-1',
            col: 0,
            row: 0,
            backgroundKey: selectedRoom?.backgroundKey || activeBackground,
            objective: `Editing ${selectedRoom?.name || 'room'}`,
            postUnlockObjective: '',
          },
        ],
      },
      worldObjects,
    };
  }, [
    activeBackground,
    defaultPlatformTextureKey,
    selectedLevel,
    selectedRoom,
    selectedRoomBackgroundTiles,
    selectedRoomComponents,
  ]);

  const roomEditorSelectedObjectIds = useMemo(() => {
    if (!selectedComponentId) {
      return [];
    }

    return selectedRoomComponents.some((component) => component.id === selectedComponentId)
      ? [selectedComponentId]
      : [];
  }, [selectedComponentId, selectedRoomComponents]);

  const exitMapTileEditing = useCallback(() => {
    setWorkspaceEditMode('components');
    setLeftSidebarMode('rooms');
    setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
    setSelectedMapTileKey('');
    setSelectedMapPlacedTileId('');
    setInspectorMode('config');
  }, []);

  useEffect(() => {
    if (isPlayMode && workspaceEditMode === 'mapTiles') {
      exitMapTileEditing();
    }
  }, [exitMapTileEditing, isPlayMode, workspaceEditMode]);

  useEffect(() => {
    if (!isMapTileSidebarAvailable && leftSidebarMode === TILE_SIDEBAR_OPTION.value) {
      setLeftSidebarMode('rooms');
    }
  }, [isMapTileSidebarAvailable, leftSidebarMode]);

  useEffect(() => {
    if (mapTileInspectorSection === MAP_TILE_SIDEBAR_SECTIONS.TILES) {
      setMapTileInspectorSection(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
    }
  }, [mapTileInspectorSection]);

  const updateRooms = useCallback((updater) => {
    setRoomChunkData((previous) => {
      const nextRooms = updater([...(previous.rooms || [])]);
      const normalized = normalizeRoomChunkData({
        ...previous,
        rooms: nextRooms,
      });
      return normalized;
    });
    setIsDirty(true);
  }, []);

  const updateGridDimension = useCallback((dimension, rawValue) => {
    if (dimension !== 'rows' && dimension !== 'cols') {
      return;
    }

    const fallback = dimension === 'rows'
      ? Number(roomChunkData?.grid?.rows) || 18
      : Number(roomChunkData?.grid?.cols) || 32;
    const safeValue = clampNumber(Number(rawValue) || fallback, 8, 80);

    setRoomChunkData((previous) => normalizeRoomChunkData({
      ...previous,
      grid: {
        ...(previous?.grid || {}),
        [dimension]: safeValue,
      },
    }));
    setIsDirty(true);
  }, [roomChunkData?.grid?.cols, roomChunkData?.grid?.rows]);

  const ensureMapTileSidebarSectionOpen = useCallback((sectionKey) => {
    setMapTileInspectorSection(sectionKey);
  }, []);

  const updateSelectedRoomBackgroundTiles = useCallback((updater) => {
    if (!selectedRoomId) {
      return;
    }

    updateRooms((currentRooms) => currentRooms.map((room) => {
      if (room.id !== selectedRoomId) {
        return room;
      }

      const currentTiles = Array.isArray(room.backgroundTiles) ? room.backgroundTiles : [];
      const nextTilesCandidate = typeof updater === 'function'
        ? updater(currentTiles)
        : updater;
      const nextTiles = Array.isArray(nextTilesCandidate)
        ? remapMapTileLayerIndexes(nextTilesCandidate)
        : currentTiles;

      return {
        ...room,
        backgroundTiles: nextTiles,
      };
    }));
  }, [selectedRoomId, updateRooms]);

  const handleMapCanvasAction = useCallback(({ point, erase = false }) => {
    if (!selectedRoomId || !point) {
      return;
    }

    const snappedX = clampNumber(Math.round(point.x), 0, EDITOR_VIEWPORT.width);
    const snappedY = clampNumber(Math.round(point.y), 0, EDITOR_VIEWPORT.height);
    const eraseRequested = erase || isMapTileEraseMode;

    if (eraseRequested) {
      let removedSelectedTile = false;
      updateSelectedRoomBackgroundTiles((currentTiles) => {
        if (!currentTiles.length) {
          return currentTiles;
        }

        const threshold = mapTileSnap > 0
          ? Math.max(10, Number(mapTileSnap) * 0.5)
          : 14;
        const nearest = currentTiles
          .map((tile, index) => {
            const deltaX = Number(tile.x || 0) - snappedX;
            const deltaY = Number(tile.y || 0) - snappedY;
            return {
              index,
              distance: Math.hypot(deltaX, deltaY),
            };
          })
          .sort((left, right) => left.distance - right.distance)[0];

        if (!nearest || nearest.distance > threshold) {
          return currentTiles;
        }

        const removedTile = currentTiles[nearest.index];
        if (removedTile?.id && removedTile.id === selectedMapPlacedTileId) {
          removedSelectedTile = true;
        }

        return currentTiles.filter((_, index) => index !== nearest.index);
      });

      if (removedSelectedTile) {
        setSelectedMapPlacedTileId('');
      }
      return;
    }

    const hasTileSelection = Boolean(selectedMapTile?.key);
    if (!hasTileSelection) {
      if (isMapTilePaintMode) {
        toast.error('Select a tile from the right sidebar first.');
      }
      return;
    }

    const safeSize = clampNumber(Number(mapTileSize) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE);
    let changedTileId = '';

    updateSelectedRoomBackgroundTiles((currentTiles) => {
      const nextTiles = Array.isArray(currentTiles) ? [...currentTiles] : [];
      const matchIndex = nextTiles.findIndex((tile) => (
        Math.abs(Number(tile.x || 0) - snappedX) <= (mapTileSnap > 0 ? Math.max(4, Number(mapTileSnap) * 0.25) : 6)
        && Math.abs(Number(tile.y || 0) - snappedY) <= (mapTileSnap > 0 ? Math.max(4, Number(mapTileSnap) * 0.25) : 6)
      ));
      const currentMaxLayer = nextTiles.reduce((highest, tile, index) => (
        Math.max(highest, normalizeMapTileZIndex(tile?.zIndex, index))
      ), -1);
      const resolvedLayer = matchIndex >= 0
        ? normalizeMapTileZIndex(nextTiles[matchIndex]?.zIndex, matchIndex)
        : clampNumber(currentMaxLayer + 1, 0, MAX_MAP_TILE_Z_INDEX);

      const nextTile = {
        id: nextTiles[matchIndex]?.id || `tile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        tileKey: selectedMapTile.key,
        x: snappedX,
        y: snappedY,
        size: safeSize,
        zIndex: resolvedLayer,
        rotationDeg: matchIndex >= 0
          ? normalizeMapTileRotation(nextTiles[matchIndex]?.rotationDeg, 0)
          : normalizeMapTileRotation(mapTileRotationDeg, 0),
        flipX: matchIndex >= 0
          ? Boolean(nextTiles[matchIndex]?.flipX)
          : Boolean(mapTileFlipX),
        flipY: matchIndex >= 0
          ? Boolean(nextTiles[matchIndex]?.flipY)
          : Boolean(mapTileFlipY),
      };
      changedTileId = nextTile.id;

      if (matchIndex >= 0) {
        nextTiles[matchIndex] = nextTile;
        return nextTiles;
      }

      return [...nextTiles, nextTile];
    });

    if (changedTileId) {
      setSelectedMapPlacedTileId(changedTileId);
    }

    if (!isMapTilePaintMode) {
      setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
      setSelectedMapTileKey('');
    }
  }, [
    isMapTileEraseMode,
    isMapTilePaintMode,
    mapTileSize,
    mapTileSnap,
    mapTileFlipX,
    mapTileFlipY,
    mapTileRotationDeg,
    selectedMapTile,
    selectedMapPlacedTileId,
    selectedRoomId,
    updateSelectedRoomBackgroundTiles,
  ]);

  const clearSelectedRoomBackgroundTiles = useCallback(() => {
    if (!selectedRoomId) {
      return;
    }

    updateSelectedRoomBackgroundTiles([]);
    setSelectedMapPlacedTileId('');
  }, [selectedRoomId, updateSelectedRoomBackgroundTiles]);

  const handleMapTileSelectionChange = useCallback((tileId) => {
    const nextTileId = typeof tileId === 'string' ? tileId : '';
    setSelectedMapPlacedTileId(nextTileId);

    if (!nextTileId) {
      return;
    }

    const hitTile = selectedRoomBackgroundTiles.find((tile) => tile.id === nextTileId);
    if (!hitTile) {
      return;
    }

    setMapTileSize(
      clampNumber(Number(hitTile.size) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE),
    );
    setMapTileRotationDeg(normalizeMapTileRotation(hitTile.rotationDeg, 0));
    setMapTileFlipX(Boolean(hitTile.flipX));
    setMapTileFlipY(Boolean(hitTile.flipY));
    ensureMapTileSidebarSectionOpen(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
  }, [ensureMapTileSidebarSectionOpen, selectedRoomBackgroundTiles]);

  const handleMapTileMove = useCallback(({ id, point }) => {
    if (!selectedRoomId || !id || !point) {
      return;
    }

    updateSelectedRoomBackgroundTiles((currentTiles) => currentTiles.map((tile) => (
      tile.id === id
        ? {
            ...tile,
            x: clampNumber(Math.round(point.x), 0, EDITOR_VIEWPORT.width),
            y: clampNumber(Math.round(point.y), 0, EDITOR_VIEWPORT.height),
          }
        : tile
    )));
  }, [selectedRoomId, updateSelectedRoomBackgroundTiles]);

  const updateSelectedMapPlacedTile = useCallback((updater) => {
    if (!selectedMapPlacedTileId) {
      return;
    }

    updateSelectedRoomBackgroundTiles((currentTiles) => currentTiles.map((tile) => {
      if (tile.id !== selectedMapPlacedTileId) {
        return tile;
      }

      if (typeof updater === 'function') {
        return updater(tile);
      }

      return {
        ...tile,
        ...(updater || {}),
      };
    }));
  }, [selectedMapPlacedTileId, updateSelectedRoomBackgroundTiles]);

  const handleMapTileSizeSliderChange = useCallback((rawValue) => {
    const safeSize = clampNumber(Number(rawValue) || MAP_TILE_DEFAULT_SIZE, MAP_TILE_MIN_SIZE, MAP_TILE_MAX_SIZE);
    setMapTileSize(safeSize);

    if (selectedMapPlacedTileId) {
      updateSelectedMapPlacedTile({
        size: safeSize,
      });
    }
  }, [selectedMapPlacedTileId, updateSelectedMapPlacedTile]);

  const handleMapTileRotationChange = useCallback((rawValue) => {
    const safeRotation = normalizeMapTileRotation(rawValue, 0);
    setMapTileRotationDeg(safeRotation);

    if (selectedMapPlacedTileId) {
      updateSelectedMapPlacedTile({
        rotationDeg: safeRotation,
      });
    }
  }, [selectedMapPlacedTileId, updateSelectedMapPlacedTile]);

  const handleMapTileFlipToggle = useCallback((axis) => {
    if (axis !== 'x' && axis !== 'y') {
      return;
    }

    if (axis === 'x') {
      const nextValue = !mapTileFlipXValue;
      setMapTileFlipX(nextValue);
      if (selectedMapPlacedTileId) {
        updateSelectedMapPlacedTile({ flipX: nextValue });
      }
      return;
    }

    const nextValue = !mapTileFlipYValue;
    setMapTileFlipY(nextValue);
    if (selectedMapPlacedTileId) {
      updateSelectedMapPlacedTile({ flipY: nextValue });
    }
  }, [mapTileFlipXValue, mapTileFlipYValue, selectedMapPlacedTileId, updateSelectedMapPlacedTile]);

  const shiftSelectedMapPlacedTileLayer = useCallback((delta) => {
    if (!selectedMapPlacedTileId || !Number.isFinite(delta) || delta === 0) {
      return;
    }

    updateSelectedRoomBackgroundTiles((currentTiles) => {
      const orderedTiles = remapMapTileLayerIndexes(currentTiles);
      const currentIndex = orderedTiles.findIndex((tile) => tile.id === selectedMapPlacedTileId);
      if (currentIndex < 0) {
        return orderedTiles;
      }

      const targetIndex = clampNumber(
        currentIndex + Math.trunc(delta),
        0,
        Math.max(0, orderedTiles.length - 1),
      );

      if (targetIndex === currentIndex) {
        return orderedTiles;
      }

      const reordered = [...orderedTiles];
      const [movedTile] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, movedTile);
      return remapMapTileLayerIndexes(reordered);
    });
  }, [selectedMapPlacedTileId, updateSelectedRoomBackgroundTiles]);

  const moveSelectedMapPlacedTileToEdge = useCallback((edge) => {
    if (!selectedMapPlacedTileId) {
      return;
    }

    updateSelectedRoomBackgroundTiles((currentTiles) => {
      const orderedTiles = remapMapTileLayerIndexes(currentTiles);
      const currentIndex = orderedTiles.findIndex((tile) => tile.id === selectedMapPlacedTileId);
      if (currentIndex < 0) {
        return orderedTiles;
      }

      const targetIndex = edge === 'front'
        ? Math.max(0, orderedTiles.length - 1)
        : 0;

      if (targetIndex === currentIndex) {
        return orderedTiles;
      }

      const reordered = [...orderedTiles];
      const [movedTile] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, movedTile);
      return remapMapTileLayerIndexes(reordered);
    });
  }, [selectedMapPlacedTileId, updateSelectedRoomBackgroundTiles]);

  const removeSelectedMapPlacedTile = useCallback(() => {
    if (!selectedMapPlacedTileId) {
      return;
    }

    updateSelectedRoomBackgroundTiles((currentTiles) => currentTiles.filter((tile) => tile.id !== selectedMapPlacedTileId));
    setSelectedMapPlacedTileId('');
  }, [selectedMapPlacedTileId, updateSelectedRoomBackgroundTiles]);

  useEffect(() => {
    let cancelled = false;

    const loadCanvas = async () => {
      setIsLoading(true);

      try {
        const response = await teacherLevelEditorAPI.getLevelCanvas(selectedLevel);
        const canvas = response?.data?.canvas || {};

        const normalizedRoomChunkData = canvas.roomChunkData
          ? normalizeRoomChunkData(canvas.roomChunkData)
          : legacyCellBackgroundsToRoomChunk(
              canvas.cellBackgrounds || {},
              canvas.gridRows,
              canvas.gridCols,
            );

        if (cancelled) {
          return;
        }

        const firstRoomId = normalizedRoomChunkData.rooms?.[0]?.id || null;

        setRoomChunkData(normalizedRoomChunkData);
        setSelectedRoomId(firstRoomId);
        setActiveBackground(
          normalizedRoomChunkData.rooms?.[0]?.backgroundKey
          || normalizedRoomChunkData.settings?.backgroundKey
          || DEFAULT_LEVEL_SETTINGS.backgroundKey,
        );
        setCanvasMeta({
          id: canvas.id || null,
          updatedAt: canvas.updatedAt || null,
        });
        setIsDirty(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const handled = handleAPIError(error);
        toast.error(handled.message || 'Unable to load level canvas');

        const fallbackChunk = createDefaultRoomChunkData();
        setRoomChunkData(fallbackChunk);
        setSelectedRoomId(fallbackChunk.rooms?.[0]?.id || null);
        setActiveBackground(DEFAULT_LEVEL_SETTINGS.backgroundKey);
        setCanvasMeta({ id: null, updatedAt: null });
        setIsDirty(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadCanvas();

    return () => {
      cancelled = true;
    };
  }, [selectedLevel]);

  useEffect(() => {
    if (!rooms.length) {
      setSelectedRoomId(null);
      return;
    }

    if (!selectedRoomId || !roomLookup[selectedRoomId]) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [roomLookup, rooms, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoom) {
      return;
    }

    setActiveBackground(selectedRoom.backgroundKey || levelSettings.backgroundKey || DEFAULT_LEVEL_SETTINGS.backgroundKey);
  }, [levelSettings.backgroundKey, selectedRoom]);

  useEffect(() => {
    if (!availableLinkTargets.length) {
      setLinkDraftTargetId('');
      return;
    }

    if (!availableLinkTargets.some((room) => room.id === linkDraftTargetId)) {
      setLinkDraftTargetId(availableLinkTargets[0].id);
    }
  }, [availableLinkTargets, linkDraftTargetId]);

  useEffect(() => {
    setPreviewRunNonce(0);
  }, [selectedLevel, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomComponents.length) {
      setSelectedComponentId('');
      return;
    }

    if (!selectedComponentId || !selectedRoomComponents.some((component) => component.id === selectedComponentId)) {
      setSelectedComponentId(selectedRoomComponents[0].id);
    }
  }, [selectedComponentId, selectedRoomComponents]);

  useEffect(() => {
    setSelectedMapPlacedTileId('');
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedMapPlacedTileId) {
      return;
    }

    if (!selectedRoomBackgroundTiles.some((tile) => tile.id === selectedMapPlacedTileId)) {
      setSelectedMapPlacedTileId('');
    }
  }, [selectedMapPlacedTileId, selectedRoomBackgroundTiles]);

  useEffect(() => {
    if (!selectedMapPlacedTile || workspaceEditMode !== 'mapTiles') {
      return;
    }

    ensureMapTileSidebarSectionOpen(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
  }, [ensureMapTileSidebarSectionOpen, selectedMapPlacedTile, workspaceEditMode]);

  const restartPreview = useCallback(() => {
    setPreviewRunNonce((previous) => previous + 1);
  }, []);

  const handleSaveCanvas = useCallback(async () => {
    try {
      setIsSaving(true);

      const payload = {
        gridRows: roomChunkData.grid?.rows,
        gridCols: roomChunkData.grid?.cols,
        roomChunkData,
        cellBackgrounds: roomChunkToLegacyCellBackgrounds(roomChunkData),
      };

      const response = await teacherLevelEditorAPI.saveLevelCanvas(selectedLevel, payload);
      const canvas = response?.data?.canvas || {};

      const normalizedRoomChunkData = canvas.roomChunkData
        ? normalizeRoomChunkData(canvas.roomChunkData)
        : legacyCellBackgroundsToRoomChunk(
            canvas.cellBackgrounds || {},
            canvas.gridRows,
            canvas.gridCols,
          );

      setRoomChunkData(normalizedRoomChunkData);
      setCanvasMeta({
        id: canvas.id || null,
        updatedAt: canvas.updatedAt || null,
      });
      setIsDirty(false);

      if (!normalizedRoomChunkData.rooms.some((room) => room.id === selectedRoomId)) {
        setSelectedRoomId(normalizedRoomChunkData.rooms?.[0]?.id || null);
      }

      toast.success('Level canvas saved');
      return true;
    } catch (error) {
      const handled = handleAPIError(error);
      toast.error(handled.message || 'Unable to save level canvas');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [roomChunkData, selectedLevel, selectedRoomId]);

  const handleSaveAndExitMapTileMode = useCallback(async () => {
    const saved = await handleSaveCanvas();
    if (!saved) {
      return;
    }

    exitMapTileEditing();
  }, [exitMapTileEditing, handleSaveCanvas]);

  const updateLevelSettings = useCallback((updater) => {
    setRoomChunkData((previous) => {
      const currentSettings = {
        ...DEFAULT_LEVEL_SETTINGS,
        ...(previous?.settings || {}),
      };

      const requestedSettings = typeof updater === 'function'
        ? updater(currentSettings)
        : {
            ...currentSettings,
            ...(updater || {}),
          };

      return normalizeRoomChunkData({
        ...previous,
        settings: requestedSettings,
      });
    });
    setIsDirty(true);
  }, []);

  const applyBackgroundToSelectedRoom = (backgroundKey) => {
    if (!selectedRoomId) {
      return;
    }

    const safeKey = typeof backgroundKey === 'string' && backgroundKey.trim()
      ? backgroundKey.trim()
      : DEFAULT_LEVEL_SETTINGS.backgroundKey;

    updateRooms((currentRooms) => currentRooms.map((room) => ({
      ...room,
      backgroundKey: room.id === selectedRoomId
        ? safeKey
        : room.backgroundKey,
    })));

    setActiveBackground(safeKey);
  };

  const applyBackgroundColorToSelectedRoom = (colorValue) => {
    if (!selectedRoomId) {
      return;
    }

    const safeColor = typeof colorValue === 'string' && /^#[0-9a-fA-F]{6}$/.test(colorValue)
      ? colorValue.toLowerCase()
      : DEFAULT_ROOM_BACKGROUND_COLOR;

    updateRooms((currentRooms) => currentRooms.map((room) => ({
      ...room,
      backgroundColor: room.id === selectedRoomId
        ? safeColor
        : (room.backgroundColor || DEFAULT_ROOM_BACKGROUND_COLOR),
    })));
  };

  const handleAddRoom = () => {
    const nextPosition = getNextRoomPosition(rooms);
    const nextRoomId = `room-${Date.now()}`;
    const nextRoom = {
      id: nextRoomId,
      name: `Room ${rooms.length + 1}`,
      row: nextPosition.row,
      col: nextPosition.col,
      backgroundKey: selectedRoom?.backgroundKey || activeBackground || levelSettings.backgroundKey || DEFAULT_LEVEL_SETTINGS.backgroundKey,
      backgroundColor: selectedRoom?.backgroundColor || DEFAULT_ROOM_BACKGROUND_COLOR,
      links: [],
      components: [],
      portal: {
        targetRoomId: null,
        endsLevel: true,
      },
    };

    updateRooms((currentRooms) => [...currentRooms, nextRoom]);
    setSelectedRoomId(nextRoomId);
  };

  const handleDeleteSelectedRoom = () => {
    if (!selectedRoomId) {
      return;
    }

    if (rooms.length <= 1) {
      toast.error('At least one room must remain');
      return;
    }

    const retainedRooms = rooms.filter((room) => room.id !== selectedRoomId);
    const nextSelectedRoomId = retainedRooms[Math.max(0, selectedRoomIndex - 1)]?.id || retainedRooms[0]?.id || null;

    updateRooms((currentRooms) => currentRooms
      .filter((room) => room.id !== selectedRoomId)
      .map((room) => ({
        ...room,
        links: Array.isArray(room.links)
          ? room.links.filter((link) => link.targetRoomId !== selectedRoomId)
          : [],
        portal: room.portal?.targetRoomId === selectedRoomId
          ? { targetRoomId: null, endsLevel: true }
          : room.portal,
      })));

    setSelectedRoomId(nextSelectedRoomId);
  };

  const goToPreviousRoom = () => {
    if (selectedRoomIndex <= 0) {
      return;
    }
    setSelectedRoomId(rooms[selectedRoomIndex - 1]?.id || null);
  };

  const goToNextRoom = () => {
    if (selectedRoomIndex < 0 || selectedRoomIndex >= rooms.length - 1) {
      return;
    }
    setSelectedRoomId(rooms[selectedRoomIndex + 1]?.id || null);
  };

  const addRoomLink = () => {
    if (!selectedRoomId || !linkDraftTargetId) {
      return;
    }

    updateRooms((currentRooms) => currentRooms.map((room) => {
      if (room.id !== selectedRoomId) {
        return room;
      }

      const links = Array.isArray(room.links) ? room.links : [];
      if (links.some((link) => link.targetRoomId === linkDraftTargetId)) {
        return room;
      }

      if (links.length >= 12) {
        toast.error('A room can only have up to 12 links');
        return room;
      }

      return {
        ...room,
        links: [...links, { targetRoomId: linkDraftTargetId, doorway: 'AUTO' }],
      };
    }));
  };

  const updateRoomLinkDoorway = (targetRoomId, doorway) => {
    updateRooms((currentRooms) => currentRooms.map((room) => {
      if (room.id !== selectedRoomId) {
        return room;
      }

      const links = Array.isArray(room.links) ? room.links : [];
      return {
        ...room,
        links: links.map((link) => (
          link.targetRoomId === targetRoomId
            ? { ...link, doorway }
            : link
        )),
      };
    }));
  };

  const removeRoomLink = (targetRoomId) => {
    updateRooms((currentRooms) => currentRooms.map((room) => {
      if (room.id !== selectedRoomId) {
        return room;
      }

      const links = Array.isArray(room.links) ? room.links : [];
      return {
        ...room,
        links: links.filter((link) => link.targetRoomId !== targetRoomId),
      };
    }));
  };

  const focusComponentInspector = useCallback((componentId) => {
    if (!componentId) {
      return;
    }

    setSelectedComponentId(componentId);
    setInspectorMode('config');

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsInspectorPanelOpen(true);
    }
  }, []);

  const addComponentToSelectedRoom = (componentType, dropPoint = null) => {
    if (!selectedRoomId) {
      toast.error('Select a room first');
      return;
    }

    const componentConfig = componentConfigByType[componentType];
    if (!componentConfig) {
      return;
    }

    const point = dropPoint || {
      x: Math.round(EDITOR_VIEWPORT.width * 0.5),
      y: Math.round(EDITOR_VIEWPORT.height * 0.5),
    };

    const normalizedPoint = {
      x: clampNumber(Math.round(point.x), 0, EDITOR_VIEWPORT.width),
      y: clampNumber(Math.round(point.y), 0, EDITOR_VIEWPORT.height),
    };

    let createdComponentId = '';

    updateRooms((currentRooms) => {
      return currentRooms.map((room) => {
        if (room.id !== selectedRoomId) {
          return room;
        }

        const existingComponents = Array.isArray(room.components) ? room.components : [];
        if (!componentConfig.singleton && existingComponents.length >= MAX_ROOM_COMPONENTS) {
          toast.error('This room reached the component limit');
          return room;
        }

        const nextComponent = {
          id: `cmp-${componentType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          ...componentConfig.create({
            x: normalizedPoint.x,
            y: normalizedPoint.y,
            defaultTextureKey: defaultPlatformTextureKey,
          }),
        };

        const nextComponents = componentConfig.singleton
          ? [...existingComponents.filter((component) => component.type !== componentType), nextComponent]
          : [...existingComponents, nextComponent];

        createdComponentId = nextComponent.id;

        return {
          ...room,
          components: nextComponents,
        };
      });
    });

    if (createdComponentId) {
      focusComponentInspector(createdComponentId);
    }
  };

  const updateSelectedRoomComponent = (componentId, updater) => {
    if (!selectedRoomId || !componentId) {
      return;
    }

    updateRooms((currentRooms) => currentRooms.map((room) => {
      if (room.id !== selectedRoomId) {
        return room;
      }

      const components = Array.isArray(room.components) ? room.components : [];
      return {
        ...room,
        components: components.map((component) => {
          if (component.id !== componentId) {
            return component;
          }

          if (typeof updater === 'function') {
            return updater(component);
          }

          return {
            ...component,
            ...updater,
          };
        }),
      };
    }));
  };

  const updateSelectedPortalLinkName = useCallback((componentId, rawLinkName) => {
    if (!componentId) {
      return;
    }

    const nextLinkName = typeof rawLinkName === 'string' ? rawLinkName.trim().slice(0, 40) : '';

    if (nextLinkName) {
      const matchCount = rooms.reduce((count, room) => {
        const roomComponents = Array.isArray(room.components) ? room.components : [];
        return count + roomComponents.filter((entry) => (
          entry.id !== componentId
          && entry.type === 'portal'
          && typeof entry.linkName === 'string'
          && entry.linkName.trim() === nextLinkName
        )).length;
      }, 0);

      if (matchCount >= 2) {
        toast.error('A portal name can only be used by two portals in this level');
        return;
      }
    }

    updateSelectedRoomComponent(componentId, (component) => {
      if (component.type !== 'portal') {
        return component;
      }

      if (!nextLinkName) {
        return {
          ...component,
          linkName: '',
        };
      }

      return {
        ...component,
        linkName: nextLinkName,
      };
    });
  }, [rooms, updateSelectedRoomComponent]);

  const updateSelectedComponentPartial = useCallback((partial) => {
    if (!selectedComponent?.id || !partial || typeof partial !== 'object') {
      return;
    }

    updateSelectedRoomComponent(selectedComponent.id, partial);
  }, [selectedComponent?.id, updateSelectedRoomComponent]);

  const updateSelectedComponentWith = useCallback((updater) => {
    if (!selectedComponent?.id || typeof updater !== 'function') {
      return;
    }

    updateSelectedRoomComponent(selectedComponent.id, updater);
  }, [selectedComponent?.id, updateSelectedRoomComponent]);

  const deleteSelectedComponent = useCallback(() => {
    if (!selectedComponent?.id || !selectedRoomId) {
      return;
    }

    const componentId = selectedComponent.id;

    updateRooms((currentRooms) => currentRooms.map((room) => ({
      ...room,
      components: room.id === selectedRoomId
        ? (Array.isArray(room.components)
          ? room.components.filter((component) => component.id !== componentId)
          : [])
        : room.components,
    })));

    setSelectedComponentId('');
    toast.success('Component deleted');
  }, [selectedComponent, selectedRoomId, updateRooms]);

  const handleRoomEditorSelectionChange = useCallback((nextSelection = []) => {
    if (!Array.isArray(nextSelection) || !nextSelection.length) {
      setSelectedComponentId('');
      return;
    }

    const firstKnownId = nextSelection.find((editorId) => (
      selectedRoomComponents.some((component) => component.id === editorId)
    ));

    if (!firstKnownId) {
      setSelectedComponentId('');
      return;
    }

    focusComponentInspector(firstKnownId);
  }, [focusComponentInspector, selectedRoomComponents]);

  const handleRoomEditorMoveObjects = useCallback((changes = []) => {
    if (!selectedRoomId || !Array.isArray(changes) || !changes.length) {
      return;
    }

    const changesById = new Map(changes.map((change) => [change.editorId, change]));

    updateRooms((currentRooms) => currentRooms.map((room) => {
      if (room.id !== selectedRoomId) {
        return room;
      }

      const components = Array.isArray(room.components) ? room.components : [];
      return {
        ...room,
        components: components.map((component) => {
          const change = changesById.get(component.id);
          if (!change) {
            return component;
          }

          return {
            ...component,
            x: clampNumber(Math.round(change.x), 0, EDITOR_VIEWPORT.width),
            y: clampNumber(
              Math.round(change.y),
              component.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MIN : 0,
              component.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MAX : EDITOR_VIEWPORT.height,
            ),
          };
        }),
      };
    }));

    const firstMovedId = changes.find((change) => changesById.has(change.editorId))?.editorId;
    if (firstMovedId) {
      focusComponentInspector(firstMovedId);
    }
  }, [focusComponentInspector, selectedRoomId, updateRooms]);

  const handleRoomEditorResizeObject = useCallback((change) => {
    if (!change?.editorId) {
      return;
    }

    updateSelectedRoomComponent(change.editorId, (component) => {
      const nextComponent = { ...component };

      if (change.x !== undefined) {
        nextComponent.x = clampNumber(Math.round(change.x), 0, EDITOR_VIEWPORT.width);
      }

      if (change.y !== undefined) {
        nextComponent.y = clampNumber(
          Math.round(change.y),
          nextComponent.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MIN : 0,
          nextComponent.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MAX : EDITOR_VIEWPORT.height,
        );
      }

      if (nextComponent.type === 'platform' || nextComponent.type === 'barrier' || nextComponent.type === 'invisiblePlatform') {
        if (change.width !== undefined) {
          nextComponent.width = clampNumber(
            Number(change.width),
            nextComponent.type === 'barrier' ? 24 : 40,
            nextComponent.type === 'barrier' ? 640 : 1280,
          );
        }

        if ((nextComponent.type === 'platform' || nextComponent.type === 'barrier') && change.bodyHeight !== undefined) {
          nextComponent.bodyHeight = clampNumber(Number(change.bodyHeight), 8, 220);
        }
      }

      if (nextComponent.type === 'barrier' && change.height !== undefined) {
        nextComponent.height = clampNumber(Number(change.height), 32, 720);
      }

      if (nextComponent.type === 'invisiblePlatform' && change.height !== undefined) {
        nextComponent.height = clampNumber(Number(change.height), 8, 360);
      }

      return nextComponent;
    });
  }, [updateSelectedRoomComponent]);

  const handleRoomEditorAddObject = useCallback((editorObjectType, point) => {
    const componentType = EDITOR_OBJECT_TO_TEACHER_COMPONENT_TYPE[editorObjectType];
    if (!componentType) {
      return;
    }

    addComponentToSelectedRoom(componentType, point);
  }, [addComponentToSelectedRoom]);

  const roomsSidebarContent = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span>{rooms.length} rooms</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAddRoom}
            disabled={isLoading}
            className="inline-flex items-center rounded-md border border-emerald-400 bg-emerald-500 px-2 py-1 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDeleteSelectedRoom}
            disabled={isLoading || !selectedRoomId}
            className="inline-flex items-center rounded-md border border-rose-400 bg-rose-500 px-2 py-1 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={goToPreviousRoom}
          disabled={isLoading || selectedRoomIndex <= 0}
          className="rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goToNextRoom}
          disabled={isLoading || selectedRoomIndex < 0 || selectedRoomIndex >= rooms.length - 1}
          className="rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {rooms.map((room, index) => {
          const isSelected = room.id === selectedRoomId;
          return (
            <div
              key={room.id}
              className={`flex items-start gap-2 rounded-xl border p-2 transition ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-950/80 text-slate-200 hover:border-slate-500'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomId(room.id);
                  setIsRoomsPanelOpen(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-xs font-black uppercase tracking-[0.08em]">Room {index + 1}</p>
                <p className="truncate text-sm font-semibold">{room.name}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{room.backgroundKey}</span>
                  <span>{Array.isArray(room.links) ? room.links.length : 0} links</span>
                  <span>{Array.isArray(room.components) ? room.components.length : 0} components</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRoomId(room.id);
                  setWorkspaceEditMode('mapTiles');
                  setLeftSidebarMode(TILE_SIDEBAR_OPTION.value);
                  setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
                  setSelectedMapTileKey('');
                  setSelectedMapPlacedTileId('');
                  setMapTileInspectorSection(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
                  setInspectorMode('levelSettings');
                  setIsRoomsPanelOpen(false);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setIsInspectorPanelOpen(true);
                  }
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/70 bg-emerald-500/20 text-emerald-200 transition hover:bg-emerald-500/35"
                title="Edit room background tiles"
                aria-label={`Edit tiles for ${room.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );

  const componentsSidebarContent = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {!selectedRoomId ? (
        <p className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-xs text-slate-400">
          Select a room first to add components.
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-950/70 p-2">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Palette</p>
            <select
              value={paletteFilter}
              onChange={(event) => setPaletteFilter(event.target.value)}
              className="ml-auto rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100"
            >
              {PALETTE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
            {filteredComponentLibrary.length === 0 ? (
              <p className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-400">
                No components match this filter.
              </p>
            ) : (
              filteredComponentLibrary.map((component) => (
                <button
                  key={component.type}
                  type="button"
                  onClick={() => addComponentToSelectedRoom(component.type)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-left transition hover:border-cyan-400 hover:bg-cyan-500/10"
                  title={`Add ${component.label}`}
                >
                  <div className="flex items-center gap-3">
                    <EntityThumbnail
                      componentType={component.type}
                      resolveComponentVisual={resolveComponentVisual}
                      animated
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-100">{component.label}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  const mapTileLibrarySidebarContent = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {!selectedRoomId ? (
        <p className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-xs text-slate-400">
          Select a room to pick tiles.
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-950/70 p-2">
          <div className="mb-2 flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5 text-emerald-300" />
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Tiles</p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="left-map-tile-category-filter">
              Category Filter
            </label>
            <select
              id="left-map-tile-category-filter"
              value={mapTileCategoryFilter}
              onChange={(event) => setMapTileCategoryFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
            >
              {MAP_TILE_CATEGORY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            {selectedMapTile && (
              <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                Active tile: <span className="font-bold">{selectedMapTile.label}</span>
              </p>
            )}
          </div>

          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
            {Object.keys(groupedMapTiles).length === 0 ? (
              <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-[11px] text-slate-400">
                No tiles in this category filter.
              </p>
            ) : Object.entries(groupedMapTiles).map(([groupLabel, groupTiles]) => (
              <div key={groupLabel} className="rounded-xl border border-slate-700 bg-slate-900/50 p-2">
                <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">{groupLabel}</p>
                <div className="grid grid-cols-3 gap-2">
                  {groupTiles.map((tile) => {
                    const isSelected = tile.key === selectedMapTile?.key;
                    return (
                      <button
                        key={tile.key}
                        type="button"
                        onClick={() => {
                          setSelectedMapTileKey(tile.key);
                          setSelectedMapPlacedTileId('');
                          if (mapTileToolMode === MAP_TILE_TOOL_MODES.ERASE) {
                            setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
                          }
                          ensureMapTileSidebarSectionOpen(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
                        }}
                        className={`rounded-lg border p-1 transition ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500/15'
                            : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                        }`}
                        title={tile.label}
                      >
                        <img
                          src={tile.url}
                          alt={tile.label}
                          draggable={false}
                          className="h-14 w-full rounded-md object-contain"
                          style={{
                            imageRendering: 'pixelated',
                            mixBlendMode: tile.blendMode === 'screen' ? 'screen' : 'normal',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const leftSidebarPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-cyan-300" />
          <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-200">Left Sidebar</p>
        </div>
        <select
          value={leftSidebarMode}
          onChange={(event) => setLeftSidebarMode(event.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-bold text-slate-100"
        >
          {leftSidebarOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {leftSidebarMode === 'rooms'
        ? roomsSidebarContent
        : (leftSidebarMode === 'components' ? componentsSidebarContent : mapTileLibrarySidebarContent)}
    </div>
  );

  const inspectorPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-fuchsia-300" />
        <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-200">Inspector</p>
        <select
          value={inspectorMode}
          onChange={(event) => setInspectorMode(event.target.value)}
          className="ml-auto rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-bold text-slate-100"
        >
          {INSPECTOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {inspectorMode === 'levelSettings' ? (
          <>
            <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Room Background</p>
              <select
                value={selectedRoom?.backgroundKey || activeBackground || levelSettings.backgroundKey}
                onChange={(event) => {
                  setActiveBackground(event.target.value);
                  applyBackgroundToSelectedRoom(event.target.value);
                }}
                disabled={!selectedRoomId || isLoading}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {backgroundOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {backgroundByValue[selectedRoom?.backgroundKey || activeBackground]?.imageUrl && (
                <div className="h-20 w-full rounded-lg border border-slate-700 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundByValue[selectedRoom?.backgroundKey || activeBackground].imageUrl})` }} />
              )}
              <p className="text-[11px] text-slate-400">Applies to the currently selected room.</p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Gameplay Settings</p>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="level-player-health">
                  Character Health
                </label>
                <input
                  id="level-player-health"
                  type="number"
                  min={1}
                  max={10}
                  value={levelSettings.playerHealth}
                  onChange={(event) => updateLevelSettings({
                    playerHealth: clampNumber(Number(event.target.value) || DEFAULT_LEVEL_SETTINGS.playerHealth, 1, 10),
                  })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={levelSettings.timerEnabled}
                  onChange={(event) => updateLevelSettings({ timerEnabled: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                />
                Enable Level Timer
              </label>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="level-timer-seconds">
                  Timer Seconds
                </label>
                <input
                  id="level-timer-seconds"
                  type="number"
                  min={10}
                  max={3600}
                  value={levelSettings.timerSeconds}
                  onChange={(event) => updateLevelSettings({
                    timerSeconds: clampNumber(Number(event.target.value) || DEFAULT_LEVEL_SETTINGS.timerSeconds, 10, 3600),
                  })}
                  disabled={!levelSettings.timerEnabled}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {!levelSettings.timerEnabled && (
                  <p className="text-[11px] text-slate-400">Timer is off by default.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Selected Component</p>
            {!selectedComponent ? (
              <p className="text-xs text-slate-400">Select a placed component in the canvas to edit it.</p>
            ) : (
              <>
                <div className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200">
                  <p className="font-semibold">{componentConfigByType[selectedComponent.type]?.label || toDisplayLabel(selectedComponent.type)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{selectedComponent.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                    X
                    <input
                      type="number"
                      min={0}
                      max={EDITOR_VIEWPORT.width}
                      value={Number(selectedComponent.x) || 0}
                      onChange={(event) => updateSelectedComponentPartial({
                        x: clampNumber(Number(event.target.value) || 0, 0, EDITOR_VIEWPORT.width),
                      })}
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                    />
                  </label>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Y
                    <input
                      type="number"
                      min={selectedComponent.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MIN : 0}
                      max={selectedComponent.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MAX : EDITOR_VIEWPORT.height}
                      value={Number(selectedComponent.y) || 0}
                      onChange={(event) => updateSelectedComponentPartial({
                        y: clampNumber(
                          Number(event.target.value) || 0,
                          selectedComponent.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MIN : 0,
                          selectedComponent.type === 'invisiblePlatform' ? UNBOUNDED_INVISIBLE_PLATFORM_Y_MAX : EDITOR_VIEWPORT.height,
                        ),
                      })}
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                    />
                  </label>
                </div>

                {selectedComponent.type === 'platform' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Width
                      <input
                        type="number"
                        min={40}
                        max={1280}
                        value={Number(selectedComponent.width) || 220}
                        onChange={(event) => updateSelectedComponentPartial({
                          width: clampNumber(Number(event.target.value) || 220, 40, 1280),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Body Height
                      <input
                        type="number"
                        min={8}
                        max={220}
                        value={Number(selectedComponent.bodyHeight) || 24}
                        onChange={(event) => updateSelectedComponentPartial({
                          bodyHeight: clampNumber(Number(event.target.value) || 24, 8, 220),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                  </>
                )}

                {selectedComponent.type === 'invisiblePlatform' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Width
                      <input
                        type="number"
                        min={40}
                        max={1280}
                        value={Number(selectedComponent.width) || 220}
                        onChange={(event) => updateSelectedComponentPartial({
                          width: clampNumber(Number(event.target.value) || 220, 40, 1280),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Height
                      <input
                        type="number"
                        min={8}
                        max={360}
                        value={Number(selectedComponent.height) || 36}
                        onChange={(event) => updateSelectedComponentPartial({
                          height: clampNumber(Number(event.target.value) || 36, 8, 360),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <div className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">Pass-Through Sides</p>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {PASS_THROUGH_SIDE_OPTIONS.map((side) => {
                          const selectedSides = Array.isArray(selectedComponent.passThroughSides)
                            ? selectedComponent.passThroughSides
                            : [];
                          const checked = selectedSides.includes(side);

                          return (
                            <label key={side} className="flex items-center gap-2 text-xs text-slate-200">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => updateSelectedComponentWith((component) => {
                                  const currentSides = Array.isArray(component.passThroughSides)
                                    ? component.passThroughSides
                                    : [];
                                  const nextSides = event.target.checked
                                    ? [...new Set([...currentSides, side])]
                                    : currentSides.filter((entry) => entry !== side);
                                  return {
                                    ...component,
                                    passThroughSides: nextSides,
                                  };
                                })}
                                className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                              />
                              {side}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {selectedComponent.type === 'ghost' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Direction
                      <select
                        value={typeof selectedComponent.movementDirection === 'string' ? selectedComponent.movementDirection : 'LEFT'}
                        onChange={(event) => updateSelectedComponentPartial({ movementDirection: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      >
                        {GHOST_DIRECTION_OPTIONS.map((direction) => (
                          <option key={direction} value={direction}>{direction}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Patrol Distance
                      <input
                        type="number"
                        min={20}
                        max={1200}
                        value={Number(selectedComponent.patrolDistance) || 220}
                        onChange={(event) => updateSelectedComponentPartial({
                          patrolDistance: clampNumber(Number(event.target.value) || 220, 20, 1200),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Speed
                      <input
                        type="number"
                        min={10}
                        max={600}
                        value={Number(selectedComponent.speed) || 80}
                        onChange={(event) => updateSelectedComponentPartial({
                          speed: clampNumber(Number(event.target.value) || 80, 10, 600),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                  </>
                )}

                {selectedComponent.type === 'projectileEnemy' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Fire Direction
                      <select
                        value={selectedComponent.fireDirection === 'RIGHT' ? 'RIGHT' : 'LEFT'}
                        onChange={(event) => updateSelectedComponentPartial({ fireDirection: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      >
                        <option value="LEFT">LEFT</option>
                        <option value="RIGHT">RIGHT</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Fire Interval (ms)
                      <input
                        type="number"
                        min={300}
                        max={12000}
                        value={Number(selectedComponent.fireIntervalMs) || 1800}
                        onChange={(event) => updateSelectedComponentPartial({
                          fireIntervalMs: clampNumber(Number(event.target.value) || 1800, 300, 12000),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Projectile Speed
                      <input
                        type="number"
                        min={60}
                        max={900}
                        value={Number(selectedComponent.projectileSpeed) || 285}
                        onChange={(event) => updateSelectedComponentPartial({
                          projectileSpeed: clampNumber(Number(event.target.value) || 285, 60, 900),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Projectile Lifetime (ms)
                      <input
                        type="number"
                        min={200}
                        max={12000}
                        value={Number(selectedComponent.projectileLifetimeMs) || 2550}
                        onChange={(event) => updateSelectedComponentPartial({
                          projectileLifetimeMs: clampNumber(Number(event.target.value) || 2550, 200, 12000),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Initial Delay (ms)
                      <input
                        type="number"
                        min={0}
                        max={12000}
                        value={Number(selectedComponent.initialDelayMs) || 900}
                        onChange={(event) => updateSelectedComponentPartial({
                          initialDelayMs: clampNumber(Number(event.target.value) || 900, 0, 12000),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                  </>
                )}

                {selectedComponent.type === 'barrier' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Width
                      <input
                        type="number"
                        min={24}
                        max={640}
                        value={Number(selectedComponent.width) || 72}
                        onChange={(event) => updateSelectedComponentPartial({
                          width: clampNumber(Number(event.target.value) || 72, 24, 640),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Height
                      <input
                        type="number"
                        min={32}
                        max={720}
                        value={Number(selectedComponent.height) || 176}
                        onChange={(event) => updateSelectedComponentPartial({
                          height: clampNumber(Number(event.target.value) || 176, 32, 720),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Body Height
                      <input
                        type="number"
                        min={16}
                        max={720}
                        value={Number(selectedComponent.bodyHeight) || 168}
                        onChange={(event) => updateSelectedComponentPartial({
                          bodyHeight: clampNumber(Number(event.target.value) || 168, 16, 720),
                        })}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                  </>
                )}

                {selectedComponent.type === 'portal' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="selected-portal-link-name">
                      Portal Name
                    </label>
                    <input
                      id="selected-portal-link-name"
                      type="text"
                      value={typeof selectedComponent.linkName === 'string' ? selectedComponent.linkName : ''}
                      onChange={(event) => updateSelectedPortalLinkName(selectedComponent.id, event.target.value)}
                      placeholder="e.g. blue-a"
                      maxLength={40}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedComponent.locked)}
                        onChange={(event) => updateSelectedComponentPartial({ locked: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                      />
                      Locked
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedComponent.endsLevel)}
                        onChange={(event) => updateSelectedComponentPartial({ endsLevel: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                      />
                      Ends Level When Unpaired
                    </label>
                    <p className={`text-[11px] ${selectedPortalNameCount === 2 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {selectedPortalNameCount === 0
                        ? 'Name this portal to create a teleport pair.'
                        : `${selectedPortalNameCount} portal${selectedPortalNameCount === 1 ? '' : 's'} in this level currently use this name (max 2).`}
                    </p>
                  </>
                )}

                {selectedComponent.type === 'statue' && (
                  <>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Question ID
                      <input
                        type="text"
                        value={typeof selectedComponent.questionId === 'string' ? selectedComponent.questionId : ''}
                        onChange={(event) => updateSelectedComponentPartial({ questionId: event.target.value.slice(0, 80) })}
                        maxLength={80}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>

                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Question Topic (AI)
                      <input
                        type="text"
                        value={typeof selectedComponent.questionTopic === 'string' ? selectedComponent.questionTopic : ''}
                        onChange={(event) => updateSelectedComponentPartial({ questionTopic: event.target.value.slice(0, 140) })}
                        maxLength={140}
                        placeholder="Example: loops, fractions, networking"
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                      <p className="mt-1 text-[11px] normal-case tracking-normal text-slate-400">
                        AI generates question text and answers from this topic whenever the level opens.
                      </p>
                    </label>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Choices Count (AI)
                        <input
                          type="number"
                          min={2}
                          max={6}
                          value={clampNumber(Number(selectedComponent.aiChoicesCount) || 4, 2, 6)}
                          onChange={(event) => updateSelectedComponentPartial({
                            aiChoicesCount: clampNumber(Number(event.target.value) || 4, 2, 6),
                          })}
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                        />
                      </label>

                      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Difficulty (AI)
                        <select
                          value={(() => {
                            const parsed = typeof selectedComponent.aiDifficulty === 'string'
                              ? selectedComponent.aiDifficulty.trim().toLowerCase()
                              : '';
                            return AI_DIFFICULTY_OPTIONS.includes(parsed) ? parsed : 'medium';
                          })()}
                          onChange={(event) => updateSelectedComponentPartial({ aiDifficulty: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                        >
                          {AI_DIFFICULTY_OPTIONS.map((difficulty) => (
                            <option key={difficulty} value={difficulty}>{difficulty.toUpperCase()}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Language (AI)
                        <input
                          type="text"
                          value={typeof selectedComponent.aiLanguage === 'string' && selectedComponent.aiLanguage.trim()
                            ? selectedComponent.aiLanguage
                            : 'English'}
                          onChange={(event) => updateSelectedComponentPartial({ aiLanguage: event.target.value.slice(0, 40) })}
                          maxLength={40}
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                        />
                      </label>

                      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                        Grade Level (AI)
                        <input
                          type="text"
                          value={typeof selectedComponent.aiGradeLevel === 'string' ? selectedComponent.aiGradeLevel : ''}
                          onChange={(event) => updateSelectedComponentPartial({ aiGradeLevel: event.target.value.slice(0, 40) })}
                          maxLength={40}
                          placeholder="Example: Grade 6"
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                        />
                      </label>
                    </div>

                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Extra Instructions (AI)
                      <textarea
                        value={typeof selectedComponent.aiInstructions === 'string' ? selectedComponent.aiInstructions : ''}
                        onChange={(event) => updateSelectedComponentPartial({ aiInstructions: event.target.value.slice(0, 500) })}
                        rows={3}
                        maxLength={500}
                        placeholder="Example: Use real-world examples and simple vocabulary."
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>

                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Success Text
                      <input
                        type="text"
                        value={typeof selectedComponent.successText === 'string' ? selectedComponent.successText : ''}
                        onChange={(event) => updateSelectedComponentPartial({ successText: event.target.value.slice(0, 180) })}
                        maxLength={180}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>

                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Failure Text
                      <input
                        type="text"
                        value={typeof selectedComponent.failureText === 'string' ? selectedComponent.failureText : ''}
                        onChange={(event) => updateSelectedComponentPartial({ failureText: event.target.value.slice(0, 180) })}
                        maxLength={180}
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                      />
                    </label>
                  </>
                )}

                <button
                  type="button"
                  onClick={deleteSelectedComponent}
                  className="mt-3 w-full rounded-lg border border-rose-400/70 bg-rose-500/15 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-rose-200 transition hover:bg-rose-500/25"
                >
                  Delete Component
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const mapTilesInspectorPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-emerald-300" />
        <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-200">Map Tiles</p>
        <button
          type="button"
          onClick={() => {
            void handleSaveAndExitMapTileMode();
          }}
          disabled={isLoading || isSaving}
          className="ml-auto inline-flex items-center rounded-md border border-emerald-400 bg-emerald-500 px-2 py-1 text-[11px] font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Room & Exit
        </button>
        <button
          type="button"
          onClick={exitMapTileEditing}
          className="inline-flex items-center rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
        >
          Exit
        </button>
      </div>

      {!selectedRoomId ? (
        <p className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-xs text-slate-400">
          Select a room to edit background tiles.
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-tile-inspector-section">
              Sidebar Section
            </label>
            <select
              id="map-tile-inspector-section"
              value={mapTileInspectorSection}
              onChange={(event) => setMapTileInspectorSection(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
            >
              <option value={MAP_TILE_SIDEBAR_SECTIONS.CONFIG}>Config</option>
              <option value={MAP_TILE_SIDEBAR_SECTIONS.SETTINGS}>Settings</option>
            </select>
            <p className="mt-2 text-[11px] text-slate-400">
              Showing: {toDisplayLabel(mapTileInspectorSection)}
            </p>
          </div>

          {mapTileInspectorSection === MAP_TILE_SIDEBAR_SECTIONS.TILES && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-200">Tiles</p>
                <p className="text-[11px] text-slate-400">Filters and categories (platforms, background, ground, decor).</p>
              </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-tile-category-filter">
                    Category Filter
                  </label>
                  <select
                    id="map-tile-category-filter"
                    value={mapTileCategoryFilter}
                    onChange={(event) => setMapTileCategoryFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                  >
                    {MAP_TILE_CATEGORY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {selectedMapTile && (
                  <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                    Active tile: <span className="font-bold">{selectedMapTile.label}</span>
                  </p>
                )}

                {Object.keys(groupedMapTiles).length === 0 ? (
                  <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-[11px] text-slate-400">
                    No tiles in this category filter.
                  </p>
                ) : Object.entries(groupedMapTiles).map(([groupLabel, groupTiles]) => (
                  <div key={groupLabel} className="rounded-xl border border-slate-700 bg-slate-900/50 p-2">
                    <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">{groupLabel}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {groupTiles.map((tile) => {
                        const isSelected = tile.key === selectedMapTile?.key;
                        return (
                          <button
                            key={tile.key}
                            type="button"
                            onClick={() => {
                              setSelectedMapTileKey(tile.key);
                              setSelectedMapPlacedTileId('');
                              if (mapTileToolMode === MAP_TILE_TOOL_MODES.ERASE) {
                                setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
                              }
                              ensureMapTileSidebarSectionOpen(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
                            }}
                            className={`rounded-lg border p-1 transition ${
                              isSelected
                                ? 'border-emerald-400 bg-emerald-500/15'
                                : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                            }`}
                            title={tile.label}
                          >
                            <img
                              src={tile.url}
                              alt={tile.label}
                              draggable={false}
                              className="h-14 w-full rounded-md object-contain"
                              style={{
                                imageRendering: 'pixelated',
                                mixBlendMode: tile.blendMode === 'screen' ? 'screen' : 'normal',
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          )}

          {mapTileInspectorSection === MAP_TILE_SIDEBAR_SECTIONS.CONFIG && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-200">Config</p>
                <p className="text-[11px] text-slate-400">Size, rotation, flip, snap, layer, delete.</p>
              </div>
            </div>

            <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
                      setSelectedMapTileKey('');
                    }}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                      mapTileToolMode === MAP_TILE_TOOL_MODES.SELECT
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" />
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapTileToolMode(MAP_TILE_TOOL_MODES.PAINT)}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                      mapTileToolMode === MAP_TILE_TOOL_MODES.PAINT
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Brush className="h-3.5 w-3.5" />
                    Paint
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapTileToolMode(MAP_TILE_TOOL_MODES.ERASE)}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                      mapTileToolMode === MAP_TILE_TOOL_MODES.ERASE
                        ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Erase
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-tile-size">
                    Tile Size
                  </label>
                  <input
                    id="map-tile-size"
                    type="range"
                    min={MAP_TILE_MIN_SIZE}
                    max={MAP_TILE_MAX_SIZE}
                    step={4}
                    value={mapTileSizeSliderValue}
                    onChange={(event) => handleMapTileSizeSliderChange(event.target.value)}
                    className="w-full"
                  />
                  <p className="text-[11px] text-slate-400">
                    {mapTileSizeSliderValue}px
                    {selectedMapPlacedTile ? ' (selected tile)' : ' (brush)'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-tile-rotation">
                    Rotation
                  </label>
                  <input
                    id="map-tile-rotation"
                    type="range"
                    min={MAP_TILE_ROTATION_MIN}
                    max={MAP_TILE_ROTATION_MAX}
                    step={1}
                    value={mapTileRotationSliderValue}
                    onChange={(event) => handleMapTileRotationChange(event.target.value)}
                    className="w-full"
                  />
                  <p className="text-[11px] text-slate-400">
                    {mapTileRotationSliderValue}deg
                    {selectedMapPlacedTile ? ' (selected tile)' : ' (brush)'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMapTileFlipToggle('x')}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${
                      mapTileFlipXValue
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    Flip X
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMapTileFlipToggle('y')}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${
                      mapTileFlipYValue
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    Flip Y
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-tile-snap">
                    Snap Grid
                  </label>
                  <select
                    id="map-tile-snap"
                    value={mapTileSnap}
                    onChange={(event) => setMapTileSnap(Number(event.target.value))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                  >
                    {MAP_TILE_SNAP_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option > 0 ? `${option}px` : 'Off (No Snap)'}</option>
                    ))}
                  </select>
                </div>

                {!selectedMapPlacedTile ? (
                  <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-[11px] text-slate-400">
                    Select a tile on the canvas to edit layer order or delete it.
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">Layer Order</p>
                        <span className="text-[11px] font-bold text-emerald-200">
                          {normalizeMapTileZIndex(selectedMapPlacedTile.zIndex, 0)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => shiftSelectedMapPlacedTileLayer(-1)}
                          className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
                        >
                          Backward
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftSelectedMapPlacedTileLayer(1)}
                          className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
                        >
                          Forward
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelectedMapPlacedTileToEdge('back')}
                          className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
                        >
                          Send To Back
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelectedMapPlacedTileToEdge('front')}
                          className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200 transition hover:bg-slate-700"
                        >
                          Bring To Front
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={removeSelectedMapPlacedTile}
                      className="inline-flex items-center rounded-lg border border-rose-400/70 bg-rose-500/15 px-2 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/25"
                    >
                      Delete Component
                    </button>
                  </>
                )}
            </div>
          </div>
          )}

          {mapTileInspectorSection === MAP_TILE_SIDEBAR_SECTIONS.SETTINGS && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-violet-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-200">Settings</p>
                <p className="text-[11px] text-slate-400">Room background and grid sizing.</p>
              </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-room-background-key">
                    Background Image
                  </label>
                  <select
                    id="map-room-background-key"
                    value={selectedRoom?.backgroundKey || activeBackground || levelSettings.backgroundKey}
                    onChange={(event) => {
                      setActiveBackground(event.target.value);
                      applyBackgroundToSelectedRoom(event.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                  >
                    {backgroundOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300" htmlFor="map-room-background-color">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="map-room-background-color"
                      type="color"
                      value={selectedRoomBackgroundColor}
                      onChange={(event) => applyBackgroundColorToSelectedRoom(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-600 bg-slate-800 p-1"
                    />
                    <input
                      type="text"
                      value={selectedRoomBackgroundColor}
                      onChange={(event) => applyBackgroundColorToSelectedRoom(event.target.value)}
                      maxLength={7}
                      className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Grid Rows
                    <input
                      type="number"
                      min={8}
                      max={80}
                      value={Number(roomChunkData?.grid?.rows) || 18}
                      onChange={(event) => updateGridDimension('rows', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                    />
                  </label>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                    Grid Cols
                    <input
                      type="number"
                      min={8}
                      max={80}
                      value={Number(roomChunkData?.grid?.cols) || 32}
                      onChange={(event) => updateGridDimension('cols', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-100"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedRoomBackgroundTiles}
                  disabled={!selectedRoomBackgroundTiles.length}
                  className="inline-flex items-center rounded-lg border border-rose-400/70 bg-rose-500/15 px-2 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Room Tiles
                </button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-svh w-full overflow-hidden bg-[radial-gradient(circle_at_12%_0%,#1f2937_0%,#0b1120_35%,#020617_100%)] text-slate-100">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2 p-2 md:gap-3 md:p-3">
        <header className="rounded-2xl border border-slate-700/80 bg-slate-900/85 px-3 py-2 shadow-lg backdrop-blur md:px-4 md:py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/teacher')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 transition hover:bg-slate-700 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5">
              <View className="h-3.5 w-3.5 text-cyan-300" />
              <select
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(Number(event.target.value))}
                disabled={isSaving}
                className="rounded bg-transparent px-1 py-1 text-xs font-bold text-slate-100 outline-none sm:text-sm"
              >
                {LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>Level {level}</option>
                ))}
              </select>
            </div>

            {!isPlayMode && (
              <div className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={exitMapTileEditing}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                    workspaceEditMode === 'components'
                      ? 'bg-cyan-500/25 text-cyan-100'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Components
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceEditMode('mapTiles');
                    setLeftSidebarMode(TILE_SIDEBAR_OPTION.value);
                    setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
                    setSelectedMapTileKey('');
                    setSelectedMapPlacedTileId('');
                    setMapTileInspectorSection(MAP_TILE_SIDEBAR_SECTIONS.CONFIG);
                    setInspectorMode('levelSettings');
                  }}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                    workspaceEditMode === 'mapTiles'
                      ? 'bg-emerald-500/25 text-emerald-100'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Map Tiles
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRoomsPanelOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-bold text-slate-100 lg:hidden"
              >
                <Layers3 className="h-3.5 w-3.5" />
                Sidebar
              </button>
              <button
                type="button"
                onClick={() => setIsInspectorPanelOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs font-bold text-slate-100 lg:hidden"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Edit
              </button>

              <button
                type="button"
                onClick={() => setIsLiveEngineEnabled((previous) => !previous)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-xs font-bold transition ${
                  isPlayMode
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                    : 'border-cyan-400 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30'
                }`}
              >
                <View className="h-3.5 w-3.5" />
                {isPlayMode ? 'Play Mode' : 'Edit Mode'}
              </button>

              <div className="hidden text-right text-xs text-slate-400 sm:block">
                <p>{isDirty ? 'Unsaved changes' : 'Synced'}</p>
                <p>{formatTimestamp(canvasMeta.updatedAt)}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleSaveCanvas();
                }}
                disabled={isLoading || isSaving}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </header>

        <section className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:gap-3">
          <aside className="hidden min-h-0 lg:block">{leftSidebarPanel}</aside>

          <main className="flex min-h-0 flex-col rounded-2xl border border-slate-700/70 bg-slate-900/80 p-2 md:p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-600/70 bg-slate-900/70 px-1 py-0.5">
                <button
                  type="button"
                  onClick={goToPreviousRoom}
                  disabled={isLoading || selectedRoomIndex <= 0}
                  className="rounded-md border border-slate-600 bg-slate-800 p-1 text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Previous Room"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={goToNextRoom}
                  disabled={isLoading || selectedRoomIndex < 0 || selectedRoomIndex >= rooms.length - 1}
                  className="rounded-md border border-slate-600 bg-slate-800 p-1 text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Next Room"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                <Layers3 className="h-3 w-3" />
                {selectedRoom ? selectedRoom.name : 'No room selected'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                <Link2 className="h-3 w-3" />
                {selectedRoomLinks.length} links
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                <Grip className="h-3 w-3" />
                {selectedRoomComponents.length} components
              </span>
              {!isPlayMode && workspaceEditMode === 'mapTiles' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                  <Pencil className="h-3 w-3" />
                  {selectedRoomBackgroundTiles.length} tiles · {mapTileToolMode.toUpperCase()}
                </span>
              )}
            </div>

            <div ref={canvasHostRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/85">
              {isLoading ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                  Loading teacher workspace...
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div
                    style={{ width: `${fittedCanvasSize.width}px`, height: `${fittedCanvasSize.height}px` }}
                    className="relative max-h-full max-w-full"
                  >
                    {isPlayMode ? (
                      <GameCanvas
                        key={`${selectedLevel}-${selectedRoomId || 'room'}-${previewRunNonce}`}
                        levelData={previewLevelData}
                        runtimeAssets={gameOneRuntimeAssets}
                        frameClassName="h-full w-full rounded-[20px] border-slate-700/80 shadow-none"
                        canvasHostClassName="h-full w-full [&>canvas]:h-full! [&>canvas]:w-full!"
                        onLevelComplete={restartPreview}
                        onLevelFail={restartPreview}
                        onExitRequest={restartPreview}
                        resultData={null}
                        gameplayData={null}
                        isSubmitting={false}
                        canAdvanceLevel={false}
                        onRetry={restartPreview}
                        onBack={restartPreview}
                        onNextLevel={restartPreview}
                      />
                    ) : workspaceEditMode === 'mapTiles' ? (
                      <>
                        <RoomTileEditorCanvas
                          className="h-full w-full rounded-[20px] border-slate-700/80 shadow-none"
                          backgroundImageUrl={selectedRoomBackgroundImage}
                          backgroundColor={selectedRoomBackgroundColor}
                          tiles={selectedRoomBackgroundTilesResolved}
                          activeTile={selectedMapTile}
                          selectedTileId={selectedMapPlacedTileId}
                          tileSize={mapTileSize}
                          snapSize={mapTileSnap}
                          toolMode={mapTileToolMode}
                          eraseMode={isMapTileEraseMode}
                          previewRotationDeg={mapTileRotationSliderValue}
                          previewFlipX={mapTileFlipXValue}
                          previewFlipY={mapTileFlipYValue}
                          onCanvasAction={handleMapCanvasAction}
                          onTileSelect={handleMapTileSelectionChange}
                          onTileMove={handleMapTileMove}
                        />

                        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
                          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1 backdrop-blur">
                            <button
                              type="button"
                              onClick={() => {
                                setMapTileToolMode(MAP_TILE_TOOL_MODES.SELECT);
                                setSelectedMapTileKey('');
                              }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                mapTileToolMode === MAP_TILE_TOOL_MODES.SELECT
                                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                                  : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                              title="Select mode"
                              aria-label="Select mode"
                            >
                              <MousePointer2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setMapTileToolMode(MAP_TILE_TOOL_MODES.PAINT)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                mapTileToolMode === MAP_TILE_TOOL_MODES.PAINT
                                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                                  : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                              title="Paint mode"
                              aria-label="Paint mode"
                            >
                              <Brush className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setMapTileToolMode(MAP_TILE_TOOL_MODES.ERASE)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                mapTileToolMode === MAP_TILE_TOOL_MODES.ERASE
                                  ? 'border-rose-400 bg-rose-500/25 text-rose-100'
                                  : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                              title="Erase mode"
                              aria-label="Erase mode"
                            >
                              <Eraser className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <GameOneEditorCanvas
                          className="h-full w-full rounded-[20px] border-slate-700/80 shadow-none"
                          levelData={roomEditorLevelData}
                          runtimeAssets={gameOneRuntimeAssets}
                          selectedCellId={roomEditorLevelData.grid.cells[0].id}
                          selectedObjectIds={roomEditorSelectedObjectIds}
                          settings={ROOM_EDITOR_SETTINGS}
                          showCameraHints={false}
                          showCameraControls={false}
                          allowCameraNavigation={false}
                          onSelectionChange={handleRoomEditorSelectionChange}
                          onCellSelect={() => {}}
                          onBackgroundClick={() => {}}
                          onAddCell={() => {}}
                          onAddObject={handleRoomEditorAddObject}
                          onMoveObjects={handleRoomEditorMoveObjects}
                          onResizeObject={handleRoomEditorResizeObject}
                        />

                        {selectedRoomBackgroundTilesResolved.length > 0 && (
                          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
                            {selectedRoomBackgroundTilesResolved.map((tile) => {
                              const rotationDeg = normalizeMapTileRotation(tile.rotationDeg, 0);
                              const scaleX = tile.flipX ? -1 : 1;
                              const scaleY = tile.flipY ? -1 : 1;

                              return (
                                <img
                                  key={tile.id}
                                  src={tile.url}
                                  alt={tile.label || 'Tile'}
                                  draggable={false}
                                  className="absolute"
                                  style={{
                                    left: `${(Number(tile.x || 0) / EDITOR_VIEWPORT.width) * 100}%`,
                                    top: `${(Number(tile.y || 0) / EDITOR_VIEWPORT.height) * 100}%`,
                                    width: `${(Number(tile.size || MAP_TILE_DEFAULT_SIZE) / EDITOR_VIEWPORT.width) * 100}%`,
                                    transform: `translate(-50%, -50%) rotate(${rotationDeg}deg) scale(${scaleX}, ${scaleY})`,
                                    imageRendering: 'pixelated',
                                    mixBlendMode: tile.blendMode === 'screen' ? 'screen' : 'normal',
                                    zIndex: 5,
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>

          <aside className="hidden min-h-0 lg:block">
            {workspaceEditMode === 'mapTiles' && !isPlayMode ? mapTilesInspectorPanel : inspectorPanel}
          </aside>
        </section>

        {isRoomsPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/75 p-3 lg:hidden">
            <div className="h-[80svh] w-full rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Sidebar</p>
                <button
                  type="button"
                  onClick={() => setIsRoomsPanelOpen(false)}
                  className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-bold"
                >
                  Close
                </button>
              </div>
              {leftSidebarPanel}
            </div>
          </div>
        )}

        {isInspectorPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/75 p-3 lg:hidden">
            <div className="h-[86svh] w-full rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Inspector</p>
                <button
                  type="button"
                  onClick={() => setIsInspectorPanelOpen(false)}
                  className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-bold"
                >
                  Close
                </button>
              </div>
              {workspaceEditMode === 'mapTiles' && !isPlayMode ? mapTilesInspectorPanel : inspectorPanel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherLevelEditorPage;
