const path = require('path');

const {
  GAME_THREE_LEVEL_TEMPLATES,
} = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-three/data/levelCatalog.cjs',
));

const PLANNED_LEVELS_PER_GAME = 20;

const GAME_CATALOG = Object.freeze([
  {
    gameType: 'GAME_ONE',
    slug: 'game-one',
    label: 'Game 1',
    title: '2D Phaser Adventure',
    shortTitle: '2D Adventure',
    description: 'A room-based platformer that teaches movement, hazard awareness, and question gates.',
    isAvailable: true,
    plannedLevels: PLANNED_LEVELS_PER_GAME,
  },
  {
    gameType: 'GAME_TWO',
    slug: 'game-two',
    label: 'Game 2',
    title: 'Hardware Assembly Lab',
    shortTitle: 'Assembly Lab',
    description: 'Drag hardware parts into the correct motherboard slots and learn each component function.',
    isAvailable: true,
    plannedLevels: PLANNED_LEVELS_PER_GAME,
  },
  {
    gameType: 'GAME_THREE',
    slug: 'game-three',
    label: 'Game 3',
    title: 'Memory Link Quiz',
    shortTitle: 'Memory Quiz',
    description: 'Match card pairs, unlock a question for each pair, and earn points for every correct answer.',
    isAvailable: true,
    plannedLevels: PLANNED_LEVELS_PER_GAME,
  },
]);

const GAME_TYPE_VALUES = GAME_CATALOG.map((game) => game.gameType);

const GAME_ORDER_INDEX = GAME_CATALOG.reduce((accumulator, game, index) => {
  accumulator[game.gameType] = index;
  return accumulator;
}, {});

const GAME_ONE_LEVEL_TEMPLATES = Object.freeze({
  1: {
    title: 'Tutorial Grove',
    description: 'Learn movement, coins, monsters, and the villain question portal.',
  },
  2: {
    title: 'Canopy Crossfire',
    description: 'Answer questions to reveal paths while dodging the first ranged enemy attacks.',
  },
  3: {
    title: 'Skyforge Siege',
    description: 'Face hunter drones and the first sentinel encounter while solving route locks.',
  },
  4: {
    title: 'Apex Sentinel',
    description: 'A boss-focused mission where portal completion now requires sentinel defeat.',
  },
});

const GAME_TWO_LEVEL_TEMPLATES = Object.freeze({
  1: {
    title: 'Motherboard Match',
    description: 'Drag each computer part to the correct motherboard slot.',
  },
});

const buildInitialLevels = (gameType, templates, activeLevelCount) => (
  Array.from({ length: PLANNED_LEVELS_PER_GAME }, (_, index) => {
    const gameLevelNumber = index + 1;
    const template = templates[gameLevelNumber];

    return {
      levelNumber: gameLevelNumber,
      gameType,
      gameLevelNumber,
      title: template?.title || `Level ${String(gameLevelNumber).padStart(2, '0')}`,
      description: template?.description || 'Complete teacher-authored objectives and unlock the next level.',
      isActive: gameLevelNumber <= activeLevelCount,
    };
  })
);

const INITIAL_LEVEL_DEFINITIONS = Object.freeze(
  [
    ...buildInitialLevels('GAME_ONE', GAME_ONE_LEVEL_TEMPLATES, PLANNED_LEVELS_PER_GAME),
    ...buildInitialLevels('GAME_TWO', GAME_TWO_LEVEL_TEMPLATES, 1),
    ...buildInitialLevels('GAME_THREE', GAME_THREE_LEVEL_TEMPLATES, 10),
  ],
);

const getGameMeta = (gameType) => GAME_CATALOG.find((game) => game.gameType === gameType) || null;

module.exports = {
  GAME_CATALOG,
  GAME_ORDER_INDEX,
  GAME_TYPE_VALUES,
  INITIAL_LEVEL_DEFINITIONS,
  PLANNED_LEVELS_PER_GAME,
  getGameMeta,
};
