const path = require('path');

const level01 = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-one/data/levels/level-01.json',
));
const level02 = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-one/data/levels/level-02.json',
));
const level03 = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-one/data/levels/level-03.json',
));
const level04 = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-one/data/levels/level-04.json',
));
const gameTwoLevel01 = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-two/data/levels/level-01.json',
));
const {
  GAME_THREE_LEVEL_SEEDS,
} = require(path.resolve(
  __dirname,
  '../../../Frontend/src/games/game-three/data/levelCatalog.cjs',
));

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const LEVEL_CONTENT_SEEDS = Object.freeze({
  GAME_ONE: Object.freeze({
    1: level01,
    2: level02,
    3: level03,
    4: level04,
  }),
  GAME_TWO: Object.freeze({
    1: gameTwoLevel01,
  }),
  GAME_THREE: Object.freeze({
    ...GAME_THREE_LEVEL_SEEDS,
  }),
});

const createFallbackLevelContent = (gameType, gameLevelNumber, title = `Level ${gameLevelNumber}`) => ({
  id: `${String(gameType || 'game').toLowerCase()}-level-${String(gameLevelNumber).padStart(2, '0')}`,
  gameType,
  levelNumber: gameLevelNumber,
  title,
  subtitle: '',
  viewport: {
    width: 1280,
    height: 720,
  },
  ...(gameType === 'GAME_THREE'
    ? {
      objective: 'Configure this memory quiz level in the admin editor.',
      settings: {
        columns: 4,
        previewMs: 0,
        flipBackMs: 900,
      },
      pairs: [],
    }
    : {
      questions: [],
      rooms: [
        {
          id: 'room-1',
          backgroundKey: 'tutorialGrove',
          objective: 'Configure this level in the admin editor.',
          postUnlockObjective: '',
          spawn: { x: 160, y: 560 },
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
          villain: null,
          portal: {
            x: 1135,
            y: 556,
            locked: false,
            targetRoomId: null,
            endsLevel: true,
          },
        },
      ],
    }),
});

const getSeedLevelContent = (gameType, gameLevelNumber, fallbackTitle) => {
  const seededLevel = LEVEL_CONTENT_SEEDS[gameType]?.[Number(gameLevelNumber)];

  if (seededLevel) {
    return cloneJson(seededLevel);
  }

  return createFallbackLevelContent(gameType, Number(gameLevelNumber), fallbackTitle);
};

module.exports = {
  LEVEL_CONTENT_SEEDS,
  createFallbackLevelContent,
  getSeedLevelContent,
};
