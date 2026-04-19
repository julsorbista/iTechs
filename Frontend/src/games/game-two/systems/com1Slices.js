const createSprite = (relativeUrl, width, height) => Object.freeze({
  width,
  height,
  url: new URL(relativeUrl, import.meta.url).href,
});

export const gameTwoSprites = Object.freeze({
  motherboard: createSprite('../assets/processed/game-two-motherboard.png', 690, 644),
  cpu: createSprite('../assets/processed/game-two-cpu.png', 634, 635),
  ram: createSprite('../assets/processed/game-two-ram.png', 989, 279),
  gpu: createSprite('../assets/processed/game-two-gpu-v2.png', 1247, 650),
});

export const getGameTwoSprite = (spriteKey) => gameTwoSprites[spriteKey] || null;
