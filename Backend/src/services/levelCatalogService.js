const prisma = require('../lib/prisma');
const {
  GAME_CATALOG,
  GAME_ORDER_INDEX,
  INITIAL_LEVEL_DEFINITIONS,
  getGameMeta,
} = require('../config/gameCatalog');
const { getSeedLevelContent } = require('../config/levelContentCatalog');

const resolveClient = (tx) => tx || prisma;

const sortByGameTrack = (left, right) => {
  const gameDelta = (GAME_ORDER_INDEX[left.gameType] ?? 999) - (GAME_ORDER_INDEX[right.gameType] ?? 999);
  if (gameDelta !== 0) {
    return gameDelta;
  }

  return left.gameLevelNumber - right.gameLevelNumber;
};

const hasSeededGameThreePairs = (contentJson) => (
  Array.isArray(contentJson?.pairs) && contentJson.pairs.length > 0
);

const hasSeededGameTwoQuestions = (contentJson) => (
  Array.isArray(contentJson?.parts)
  && contentJson.parts.some((part) => Array.isArray(part?.question?.options) && part.question.options.length > 0)
);

const ensureLevelDefinitions = async (tx) => {
  const db = resolveClient(tx);

  for (const definition of INITIAL_LEVEL_DEFINITIONS) {
    await db.levelDefinition.upsert({
      where: {
        gameType_gameLevelNumber: {
          gameType: definition.gameType,
          gameLevelNumber: definition.gameLevelNumber,
        },
      },
      update: {
        levelNumber: definition.levelNumber,
        gameType: definition.gameType,
        gameLevelNumber: definition.gameLevelNumber,
        title: definition.title,
        description: definition.description,
        isActive: definition.isActive,
      },
      create: definition,
    });
  }
};

const ensureLevelContents = async (tx) => {
  const db = resolveClient(tx);

  const levelDefinitions = await db.levelDefinition.findMany({
    orderBy: [{ gameType: 'asc' }, { gameLevelNumber: 'asc' }],
  });

  for (const level of levelDefinitions) {
    const existingContent = await db.levelContent.findUnique({
      where: { levelId: level.id },
      select: {
        id: true,
        draftJson: true,
        publishedJson: true,
      },
    });

    const initialContent = getSeedLevelContent(level.gameType, level.gameLevelNumber, level.title);

    if (existingContent) {
      if (
        level.gameType === 'GAME_THREE'
        && !hasSeededGameThreePairs(existingContent.draftJson)
        && !hasSeededGameThreePairs(existingContent.publishedJson)
      ) {
        await db.levelContent.update({
          where: { id: existingContent.id },
          data: {
            draftJson: initialContent,
            publishedJson: initialContent,
            publishedAt: new Date(),
          },
        });
      }

      if (
        level.gameType === 'GAME_TWO'
        && !hasSeededGameTwoQuestions(existingContent.draftJson)
        && !hasSeededGameTwoQuestions(existingContent.publishedJson)
      ) {
        await db.levelContent.update({
          where: { id: existingContent.id },
          data: {
            draftJson: initialContent,
            publishedJson: initialContent,
            publishedAt: new Date(),
          },
        });
      }

      continue;
    }

    await db.levelContent.create({
      data: {
        levelId: level.id,
        draftJson: initialContent,
        publishedJson: initialContent,
        publishedAt: new Date(),
      },
    });
  }
};

const ensureLevelCatalog = async (tx) => {
  const db = resolveClient(tx);
  await ensureLevelDefinitions(db);
  await ensureLevelContents(db);
};

const getLevelDefinitionByGame = async (gameType, gameLevelNumber, tx) => {
  const db = resolveClient(tx);
  return db.levelDefinition.findUnique({
    where: {
      gameType_gameLevelNumber: {
        gameType,
        gameLevelNumber: Number(gameLevelNumber),
      },
    },
  });
};

const getAdminLevelCatalog = async () => {
  await ensureLevelCatalog();

  const levels = await prisma.levelDefinition.findMany({
    include: {
      content: {
        select: {
          id: true,
          updatedAt: true,
          publishedAt: true,
        },
      },
    },
    orderBy: [{ gameType: 'asc' }, { gameLevelNumber: 'asc' }],
  });

  const levelsByGame = levels.reduce((accumulator, level) => {
    if (!accumulator[level.gameType]) {
      accumulator[level.gameType] = [];
    }

    accumulator[level.gameType].push({
      id: level.id,
      levelNumber: level.gameLevelNumber,
      legacyLevelNumber: level.levelNumber,
      title: level.title,
      description: level.description,
      isActive: level.isActive,
      hasContent: Boolean(level.content?.id),
      updatedAt: level.content?.updatedAt || null,
      publishedAt: level.content?.publishedAt || null,
    });

    return accumulator;
  }, {});

  return {
    games: GAME_CATALOG.map((game) => ({
      ...game,
      levels: (levelsByGame[game.gameType] || []).sort((left, right) => left.levelNumber - right.levelNumber),
    })),
  };
};

module.exports = {
  GAME_CATALOG,
  GAME_ORDER_INDEX,
  ensureLevelDefinitions,
  ensureLevelContents,
  ensureLevelCatalog,
  getGameMeta,
  getLevelDefinitionByGame,
  getAdminLevelCatalog,
  sortByGameTrack,
};
