import MOSSY_TILE_PATHS from './mossyTilePaths.generated';

const platformTileModules = import.meta.glob('../../../assets/Game/game_one/Platforms/**/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  import: 'default',
});

const PORTAL_GROUP = 'Portal';
const GENERAL_GROUP = 'General';
const MOSSY_GROUP = 'Mossy Tileset';
const MOSSY_GROUP_PREFIX = 'Mossy: ';
const DISALLOWED_SEGMENTS = Object.freeze([
  'portal',
  'coins',
  'coin',
  'enemy',
  'ghost',
  'villain',
  'wizard',
  'slime',
  'boss',
  'spawn',
]);
const DISALLOWED_TILE_NAMES = new Set([
  '18',
  '2',
  'elem3',
  'landplatforms',
  'platform1',
  'platform2',
  'platform3',
  'platform4',
  'platform5',
  'platform6',
  'platform7',
  'platform8',
  'platform9',
  'platform10',
]);

const toTitleCase = (value) => value
  .split(' ')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const normalizeFileName = (value) => value
  .replace(/\.[^/.]+$/, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const toCanonicalName = (value) => value
  .toLowerCase()
  .replace(/\.[^/.]+$/, '')
  .replace(/[^a-z0-9]+/g, '');

const isMossyPath = (path) => path.includes('/mossy tileset/');

const toMossyLabel = (fileName) => {
  const normalized = normalizeFileName(fileName)
    .replace(/^mossy\s*[-_]?\s*/i, '')
    .trim();
  return toTitleCase(normalized || 'Mossy Tile');
};

const toMossyGroup = (segments) => {
  if (!Array.isArray(segments) || segments.length < 2) {
    return MOSSY_GROUP;
  }

  if (segments[0].toLowerCase() !== 'processed') {
    return MOSSY_GROUP;
  }

  const collectionLabel = toTitleCase(normalizeFileName(segments[1]).replace(/^mossy\s*[-_]?\s*/i, '').trim());
  return `${MOSSY_GROUP_PREFIX}${collectionLabel || 'Tiles'}`;
};

const parseTileEntry = (modulePath, moduleUrl) => {
  const normalizedPath = modulePath.replace(/\\/g, '/');
  const lowerPath = normalizedPath.toLowerCase();
  const platformsMatch = normalizedPath.match(/\/Platforms\/(.+)$/i);
  const mossyMatch = normalizedPath.match(/\/Mossy Tileset\/(.+)$/i);
  const relativePath = platformsMatch
    ? platformsMatch[1]
    : (mossyMatch ? mossyMatch[1] : normalizedPath);
  const noExtension = relativePath.replace(/\.[^/.]+$/, '');
  const segments = noExtension.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] || 'tile';
  const folderName = segments.length > 1 ? segments[segments.length - 2] : GENERAL_GROUP;
  const isPortalTile = /\/Platforms\/Portal\//i.test(normalizedPath);
  const isMossyTile = isMossyPath(lowerPath);
  const group = isMossyTile
    ? toMossyGroup(segments)
    : (isPortalTile ? PORTAL_GROUP : toTitleCase(folderName));

  return {
    key: `tile-${slugify(noExtension)}`,
    label: isMossyTile
      ? toMossyLabel(fileName)
      : (toTitleCase(normalizeFileName(fileName)) || 'Tile'),
    group: group || GENERAL_GROUP,
    isPortalTile,
    source: isMossyTile ? 'mossy' : 'platform',
    blendMode: isMossyTile ? 'screen' : 'normal',
    path: relativePath,
    url: moduleUrl,
  };
};

const isFunctionalAsset = (tile) => {
  if (!tile) {
    return true;
  }

  const path = String(tile.path || '').toLowerCase();
  const label = String(tile.label || '').toLowerCase();
  const pathSegments = String(tile.path || '').split('/');
  const fileName = pathSegments[pathSegments.length - 1] || '';
  const canonicalFileName = toCanonicalName(fileName);

  if (tile.source === 'mossy') {
    return false;
  }

  if (DISALLOWED_TILE_NAMES.has(canonicalFileName)) {
    return true;
  }

  return DISALLOWED_SEGMENTS.some((segment) => path.includes(segment) || label.includes(segment));
};

const groupSortOrder = (group) => {
  if (group === PORTAL_GROUP) {
    return 0;
  }

  if (group === 'Coins') {
    return 1;
  }

  if (group === GENERAL_GROUP) {
    return 2;
  }

  if (group === MOSSY_GROUP) {
    return 3;
  }

  if (group.startsWith(MOSSY_GROUP_PREFIX)) {
    return 3;
  }

  return 4;
};

const mossyTileEntries = MOSSY_TILE_PATHS.map((relativePath) => [
  `/virtual/Mossy Tileset/${relativePath}`,
  `/mossy-tiles/${relativePath}`,
]);

export const PLATFORM_TILE_CATALOG = [
  ...Object.entries(platformTileModules),
  ...mossyTileEntries,
]
  .map(([modulePath, moduleUrl]) => parseTileEntry(modulePath, moduleUrl))
  .filter((tile) => !isFunctionalAsset(tile))
  .sort((left, right) => {
    const groupDelta = groupSortOrder(left.group) - groupSortOrder(right.group);
    if (groupDelta !== 0) {
      return groupDelta;
    }

    if (left.group !== right.group) {
      return left.group.localeCompare(right.group);
    }

    return left.label.localeCompare(right.label);
  });

export const PLATFORM_TILE_BY_KEY = Object.fromEntries(
  PLATFORM_TILE_CATALOG.map((tile) => [tile.key, tile]),
);

export default PLATFORM_TILE_CATALOG;
