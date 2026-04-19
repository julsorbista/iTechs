export const getGameOneSpriteDisplaySize = (manifestEntry, fallback = {}) => {
  if (!manifestEntry?.frameWidth || !manifestEntry?.frameHeight) {
    return fallback;
  }

  const scale = Number(manifestEntry.scale || 1);
  return {
    width: Math.round(manifestEntry.frameWidth * scale),
    height: Math.round(manifestEntry.frameHeight * scale),
  };
};

export const getGameOneSurfaceMetrics = (manifest, config = {}) => {
  const textureMeta = manifest?.platforms?.[config.textureKey]
    || Object.values(manifest?.platforms || {})[0]
    || { key: '', visualHeight: 60 };
  const requestedVisualHeight = Number(config.height);
  const visualHeight = Number.isFinite(requestedVisualHeight)
    ? requestedVisualHeight
    : Number(textureMeta.visualHeight || 60);
  const requestedBodyHeight = Number(config.bodyHeight);
  const bodyHeight = Number.isFinite(requestedBodyHeight)
    ? requestedBodyHeight
    : visualHeight;
  const bodyWidth = Number(config.bodyWidth || config.width || 120);
  const collisionMode = config.collisionMode || (bodyHeight <= 28 ? 'ONE_WAY' : 'SOLID');
  const bodyOffsetY = Number(
    config.bodyOffsetY
    ?? (visualHeight > bodyHeight ? ((visualHeight - bodyHeight) / 2) : 0)
  );

  return {
    textureMeta,
    visualHeight,
    bodyHeight,
    bodyWidth,
    collisionMode,
    bodyOffsetY,
  };
};
