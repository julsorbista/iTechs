export const GAME_TYPE_ORDER = Object.freeze(['GAME_ONE', 'GAME_TWO', 'GAME_THREE']);

const GAME_TYPE_ALIASES = Object.freeze({
  GAME_ONE: 'GAME_ONE',
  GAME1: 'GAME_ONE',
  '1': 'GAME_ONE',
  GAME_ONE_TRACK: 'GAME_ONE',
  GAME_ONE_LEVELS: 'GAME_ONE',
  'GAME-ONE': 'GAME_ONE',
  GAME_TWO: 'GAME_TWO',
  GAME2: 'GAME_TWO',
  '2': 'GAME_TWO',
  'GAME-TWO': 'GAME_TWO',
  GAME_THREE: 'GAME_THREE',
  GAME3: 'GAME_THREE',
  '3': 'GAME_THREE',
  'GAME-THREE': 'GAME_THREE',
});

const GAME_TYPE_INDEX = GAME_TYPE_ORDER.reduce((accumulator, gameType, index) => {
  accumulator[gameType] = index;
  return accumulator;
}, {});

export const normalizeGameType = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const normalizedKey = trimmed
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .toUpperCase();

  return GAME_TYPE_ALIASES[normalizedKey] || null;
};

export const sortByGameType = (left, right) => (
  (GAME_TYPE_INDEX[normalizeGameType(left)] ?? 999)
  - (GAME_TYPE_INDEX[normalizeGameType(right)] ?? 999)
);

export const getGameTrackLabel = (gameType) => {
  const normalized = normalizeGameType(gameType);

  if (normalized === 'GAME_ONE') {
    return 'Game 1';
  }

  if (normalized === 'GAME_TWO') {
    return 'Game 2';
  }

  if (normalized === 'GAME_THREE') {
    return 'Game 3';
  }

  return gameType || 'Game';
};
