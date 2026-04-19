const path = require('path');
const prisma = require('../src/lib/prisma');
const {
  saveTeacherLevelCanvas,
  getTeacherSavedLevelNumbers,
} = require('../src/services/teacherLevelEditorService');

const level02 = require(path.resolve(
  __dirname,
  '../../Frontend/src/games/game-one/data/levels/level-02.json',
));
const level03 = require(path.resolve(
  __dirname,
  '../../Frontend/src/games/game-one/data/levels/level-03.json',
));
const level04 = require(path.resolve(
  __dirname,
  '../../Frontend/src/games/game-one/data/levels/level-04.json',
));

const LEVEL_MAP = new Map([
  [2, level02],
  [3, level03],
  [4, level04],
]);

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
};

const clampInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
};

const createQuestionLookup = (levelData) => (
  new Map(
    (Array.isArray(levelData?.questions) ? levelData.questions : [])
      .filter((question) => question && typeof question === 'object' && typeof question.id === 'string' && question.id.trim())
      .map((question) => [question.id.trim(), question]),
  )
);

const toRoomComponents = (room, roomIndex, questionLookup, isLastRoom) => {
  const components = [];

  if (room?.spawn) {
    components.push({
      id: `spawn-${roomIndex + 1}`,
      type: 'spawn',
      x: clampInt(room.spawn.x, 160),
      y: clampInt(room.spawn.y, 560),
    });
  }

  (Array.isArray(room?.platforms) ? room.platforms : []).forEach((platform, index) => {
    components.push({
      id: platform.id || `platform-${roomIndex + 1}-${index + 1}`,
      type: 'platform',
      x: clampInt(platform.x, 640),
      y: clampInt(platform.y, 520),
      width: clampInt(platform.width, 220),
      bodyHeight: clampInt(platform.bodyHeight, 24),
      textureKey: typeof platform.textureKey === 'string' && platform.textureKey.trim()
        ? platform.textureKey.trim()
        : 'grass',
    });
  });

  // Teacher room chunk format does not support unlock platform linkage directly.
  (Array.isArray(room?.unlockPlatforms) ? room.unlockPlatforms : []).forEach((platform, index) => {
    components.push({
      id: platform.id || `unlock-platform-${roomIndex + 1}-${index + 1}`,
      type: 'platform',
      x: clampInt(platform.x, 640),
      y: clampInt(platform.y, 520),
      width: clampInt(platform.width, 180),
      bodyHeight: clampInt(platform.bodyHeight, 24),
      textureKey: typeof platform.textureKey === 'string' && platform.textureKey.trim()
        ? platform.textureKey.trim()
        : 'grass',
    });
  });

  (Array.isArray(room?.barriers) ? room.barriers : []).forEach((barrier, index) => {
    components.push({
      id: barrier.id || `barrier-${roomIndex + 1}-${index + 1}`,
      type: 'barrier',
      x: clampInt(barrier.x, 640),
      y: clampInt(barrier.y, 500),
      width: clampInt(barrier.width, 72),
      height: clampInt(barrier.height, 176),
      bodyHeight: clampInt(barrier.bodyHeight, 168),
      textureKey: typeof barrier.textureKey === 'string' && barrier.textureKey.trim()
        ? barrier.textureKey.trim()
        : 'stone',
    });
  });

  (Array.isArray(room?.coins) ? room.coins : []).forEach((coin, index) => {
    components.push({
      id: coin.id || `coin-${roomIndex + 1}-${index + 1}`,
      type: 'coin',
      x: clampInt(coin.x, 640),
      y: clampInt(coin.y, 420),
    });
  });

  (Array.isArray(room?.ghosts) ? room.ghosts : []).forEach((ghost, index) => {
    components.push({
      id: ghost.id || `ghost-${roomIndex + 1}-${index + 1}`,
      type: 'ghost',
      x: clampInt(ghost.x, 640),
      y: clampInt(ghost.y, 592),
      patrolDistance: clampInt(ghost.patrolDistance, 220),
      speed: clampInt(ghost.speed, 80),
      movementDirection: typeof ghost.movementDirection === 'string' && ghost.movementDirection.trim()
        ? ghost.movementDirection.trim().toUpperCase()
        : 'LEFT',
    });
  });

  (Array.isArray(room?.projectileEnemies) ? room.projectileEnemies : []).forEach((enemy, index) => {
    components.push({
      id: enemy.id || `projectile-${roomIndex + 1}-${index + 1}`,
      type: 'projectileEnemy',
      enemyType: typeof enemy.enemyType === 'string' && enemy.enemyType.trim()
        ? enemy.enemyType.trim().toLowerCase()
        : 'elemental',
      x: clampInt(enemy.x, 920),
      y: clampInt(enemy.y, 556),
      fireDirection: typeof enemy.fireDirection === 'string' && enemy.fireDirection.trim()
        ? enemy.fireDirection.trim().toUpperCase()
        : 'LEFT',
      fireIntervalMs: clampInt(enemy.fireIntervalMs, 1800),
      projectileSpeed: clampInt(enemy.projectileSpeed, 285),
      projectileLifetimeMs: clampInt(enemy.projectileLifetimeMs, 2550),
      initialDelayMs: clampInt(enemy.initialDelayMs, 900),
      hitPoints: clampInt(enemy.hitPoints, enemy.enemyType === 'boss' ? 8 : 1),
    });
  });

  toArray(room?.villain).forEach((villain, index) => {
    const questionId = typeof villain.questionId === 'string' ? villain.questionId.trim() : '';
    const question = questionLookup.get(questionId) || null;
    const choices = Array.isArray(question?.choices) && question.choices.length >= 2
      ? question.choices.map((choice) => String(choice || '').trim()).filter(Boolean)
      : ['A', 'B', 'C', 'D'];

    components.push({
      id: villain.id || `statue-${roomIndex + 1}-${index + 1}`,
      type: 'statue',
      x: clampInt(villain.x, 640),
      y: clampInt(villain.y, 500),
      questionId,
      questionTopic: String(question?.prompt || '').slice(0, 140),
      aiChoicesCount: clampInt(choices.length, 4),
      aiDifficulty: 'medium',
      aiLanguage: 'English',
      aiGradeLevel: '',
      aiInstructions: '',
      prompt: String(question?.prompt || 'Solve the statue riddle.').slice(0, 240),
      choices,
      correctAnswerIndex: clampInt(question?.answerIndex, 0),
      successText: String(question?.successText || 'Correct!').slice(0, 180),
      failureText: String(question?.failureText || 'Try again.').slice(0, 180),
    });
  });

  if (room?.portal && isLastRoom) {
    components.push({
      id: room.portal.id || `portal-${roomIndex + 1}`,
      type: 'portal',
      x: clampInt(room.portal.x, 1135),
      y: clampInt(room.portal.y, 556),
      locked: Boolean(room.portal.locked),
      endsLevel: true,
      linkName: '',
    });
  }

  return components;
};

const convertLegacyLevelToRoomChunk = (levelData) => {
  const rooms = Array.isArray(levelData?.rooms) ? levelData.rooms : [];
  const questionLookup = createQuestionLookup(levelData);

  return {
    version: 1,
    grid: {
      rows: 18,
      cols: 32,
    },
    settings: {
      backgroundKey: typeof levelData?.settings?.backgroundKey === 'string' && levelData.settings.backgroundKey.trim()
        ? levelData.settings.backgroundKey.trim()
        : (rooms[0]?.backgroundKey || 'tutorialGrove'),
      playerHealth: clampInt(levelData?.settings?.playerHealth, 3),
      timerEnabled: Boolean(levelData?.settings?.timerEnabled),
      timerSeconds: clampInt(levelData?.settings?.timerSeconds, 120),
      coinGoal: clampInt(levelData?.settings?.coinGoal, 0),
      requireBossDefeat: Boolean(levelData?.settings?.requireBossDefeat),
    },
    rooms: rooms.map((room, index) => ({
      id: room.id || `room-${index + 1}`,
      name: room.id || `Room ${index + 1}`,
      row: 0,
      col: index,
      backgroundKey: typeof room.backgroundKey === 'string' && room.backgroundKey.trim()
        ? room.backgroundKey.trim()
        : 'tutorialGrove',
      links: [],
      portal: {
        targetRoomId: null,
        endsLevel: true,
      },
      components: toRoomComponents(room, index, questionLookup, index === (rooms.length - 1)),
    })),
  };
};

const main = async () => {
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', isArchived: false },
    select: { id: true, email: true },
  });

  if (!teachers.length) {
    console.log('No active teachers found.');
    return;
  }

  for (const teacher of teachers) {
    const savedLevels = new Set(await getTeacherSavedLevelNumbers(teacher.id));
    console.log(`Teacher ${teacher.email} currently has: ${Array.from(savedLevels).sort((a, b) => a - b).join(', ') || 'none'}`);

    for (const [levelNumber, levelData] of LEVEL_MAP.entries()) {
      if (savedLevels.has(levelNumber)) {
        console.log(`  Skipping level ${levelNumber}; already present.`);
        continue;
      }

      const roomChunkData = convertLegacyLevelToRoomChunk(levelData);
      await saveTeacherLevelCanvas(teacher.id, levelNumber, {
        gridRows: roomChunkData.grid.rows,
        gridCols: roomChunkData.grid.cols,
        roomChunkData,
      });

      console.log(`  Assigned level ${levelNumber} to ${teacher.email}.`);
    }

    const updatedLevels = await getTeacherSavedLevelNumbers(teacher.id);
    console.log(`Teacher ${teacher.email} now has: ${updatedLevels.join(', ') || 'none'}`);
  }
};

main()
  .catch((error) => {
    console.error('Failed to assign levels to teachers:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
