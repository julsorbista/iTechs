const MEMORY_TOPIC_POOL = Object.freeze([
  { id: 'cpu', label: 'CPU', accent: '#34d399' },
  { id: 'ram', label: 'RAM', accent: '#38bdf8' },
  { id: 'gpu', label: 'GPU', accent: '#f59e0b' },
  { id: 'bios', label: 'BIOS', accent: '#fb7185' },
  { id: 'rom', label: 'ROM', accent: '#a78bfa' },
  { id: 'lan', label: 'LAN', accent: '#22c55e' },
  { id: 'ssd', label: 'SSD', accent: '#06b6d4' },
  { id: 'hdd', label: 'HDD', accent: '#64748b' },
  { id: 'psu', label: 'PSU', accent: '#f97316' },
  { id: 'fan', label: 'FAN', accent: '#60a5fa' },
  { id: 'usb', label: 'USB', accent: '#14b8a6' },
  { id: 'hdmi', label: 'HDMI', accent: '#e879f9' },
  { id: 'router', label: 'ROUTER', accent: '#10b981' },
  { id: 'cache', label: 'CACHE', accent: '#818cf8' },
  { id: 'cmos', label: 'CMOS', accent: '#facc15' },
  { id: 'post', label: 'POST', accent: '#ef4444' },
  { id: 'modem', label: 'MODEM', accent: '#2dd4bf' },
  { id: 'chipset', label: 'CHIPSET', accent: '#8b5cf6' },
  { id: 'heatsink', label: 'HEATSINK', accent: '#3b82f6' },
  { id: 'kernel', label: 'KERNEL', accent: '#84cc16' },
]);

const GAME_THREE_LEVEL_BLUEPRINTS = Object.freeze([
  {
    levelNumber: 1,
    title: 'Boot Pair',
    subtitle: '4 cards | 2 pairs',
    description: 'A warmup round with four cards and two revealed questions.',
    pairCount: 2,
    columns: 2,
    previewMs: 1400,
    flipBackMs: 1000,
  },
  {
    levelNumber: 2,
    title: 'Port Recall',
    subtitle: '6 cards | 3 pairs',
    description: 'A small board that asks you to keep track of three quick matches.',
    pairCount: 3,
    columns: 3,
    previewMs: 1300,
    flipBackMs: 980,
  },
  {
    levelNumber: 3,
    title: 'Bus Match',
    subtitle: '8 cards | 4 pairs',
    description: 'The grid opens up and starts rewarding cleaner recall.',
    pairCount: 4,
    columns: 4,
    previewMs: 1200,
    flipBackMs: 960,
  },
  {
    levelNumber: 4,
    title: 'Circuit Sweep',
    subtitle: '12 cards | 6 pairs',
    description: 'A fuller board with more frequent question reveals.',
    pairCount: 6,
    columns: 4,
    previewMs: 1000,
    flipBackMs: 940,
  },
  {
    levelNumber: 5,
    title: 'Cache Chase',
    subtitle: '16 cards | 8 pairs',
    description: 'A balanced square grid that starts to test longer memory streaks.',
    pairCount: 8,
    columns: 4,
    previewMs: 850,
    flipBackMs: 920,
  },
  {
    levelNumber: 6,
    title: 'Signal Stack',
    subtitle: '20 cards | 10 pairs',
    description: 'The board grows wider and asks you to manage more active targets.',
    pairCount: 10,
    columns: 5,
    previewMs: 700,
    flipBackMs: 900,
  },
  {
    levelNumber: 7,
    title: 'Memory Mesh',
    subtitle: '24 cards | 12 pairs',
    description: 'A dense matrix where every clean pair matters.',
    pairCount: 12,
    columns: 6,
    previewMs: 600,
    flipBackMs: 880,
  },
  {
    levelNumber: 8,
    title: 'Binary Field',
    subtitle: '28 cards | 14 pairs',
    description: 'More cards, tighter timing, and less room for repeated mistakes.',
    pairCount: 14,
    columns: 7,
    previewMs: 500,
    flipBackMs: 860,
  },
  {
    levelNumber: 9,
    title: 'Core Grid',
    subtitle: '32 cards | 16 pairs',
    description: 'A large board built for deep recall and steady pacing.',
    pairCount: 16,
    columns: 8,
    previewMs: 350,
    flipBackMs: 840,
  },
  {
    levelNumber: 10,
    title: 'Master Matrix',
    subtitle: '36 cards | 18 pairs',
    description: 'The full challenge: a square memory field with eighteen scoring questions.',
    pairCount: 18,
    columns: 6,
    previewMs: 250,
    flipBackMs: 820,
  },
]);

const createQuestion = (label, levelNumber) => ({
  prompt: `Sample question for ${label} in level ${String(levelNumber).padStart(2, '0')}. Choose the correct option.`,
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D' },
  ],
  correctOptionId: 'a',
});

const createPairsForLevel = (levelNumber, pairCount) => {
  const offset = (levelNumber - 1) * 2;

  return Array.from({ length: pairCount }, (_, index) => {
    const topic = MEMORY_TOPIC_POOL[(offset + index) % MEMORY_TOPIC_POOL.length];

    return {
      id: `${topic.id}-l${levelNumber}`,
      label: topic.label,
      accent: topic.accent,
      badge: String(index + 1).padStart(2, '0'),
      question: createQuestion(topic.label, levelNumber),
    };
  });
};

const buildLevelSeed = (blueprint) => ({
  id: `game-three-level-${String(blueprint.levelNumber).padStart(2, '0')}`,
  gameType: 'GAME_THREE',
  levelNumber: blueprint.levelNumber,
  title: blueprint.title,
  subtitle: blueprint.subtitle,
  objective: `Find ${blueprint.pairCount} matching pairs. Each solved pair reveals a multiple-choice question worth one point.`,
  viewport: {
    width: 1280,
    height: 720,
  },
  settings: {
    columns: blueprint.columns,
    previewMs: blueprint.previewMs,
    flipBackMs: blueprint.flipBackMs,
  },
  pairs: createPairsForLevel(blueprint.levelNumber, blueprint.pairCount),
});

const GAME_THREE_LEVEL_SEEDS = Object.freeze(
  GAME_THREE_LEVEL_BLUEPRINTS.reduce((accumulator, blueprint) => {
    accumulator[blueprint.levelNumber] = buildLevelSeed(blueprint);
    return accumulator;
  }, {}),
);

const GAME_THREE_LEVEL_TEMPLATES = Object.freeze(
  GAME_THREE_LEVEL_BLUEPRINTS.reduce((accumulator, blueprint) => {
    accumulator[blueprint.levelNumber] = {
      title: blueprint.title,
      description: blueprint.description,
    };
    return accumulator;
  }, {}),
);

module.exports = {
  GAME_THREE_LEVEL_BLUEPRINTS,
  GAME_THREE_LEVEL_SEEDS,
  GAME_THREE_LEVEL_TEMPLATES,
};
