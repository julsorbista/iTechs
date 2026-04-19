export const registerGameOneAnimations = (scene, manifest) => {
  const playerIdleEndFrame = Math.max(0, Number(manifest.player?.frameCount || 1) - 1);
  const playerRunEndFrame = Math.max(0, Number(manifest.playerRun?.frameCount || 1) - 1);
  const playerJumpEndFrame = Math.max(0, Number(manifest.playerJump?.frameCount || 1) - 1);

  if (!scene.anims.exists('game-one-player-idle')) {
    scene.anims.create({
      key: 'game-one-player-idle',
      frames: scene.anims.generateFrameNumbers(manifest.player.key, { start: 0, end: playerIdleEndFrame }),
      frameRate: 12,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-player-run')) {
    scene.anims.create({
      key: 'game-one-player-run',
      frames: scene.anims.generateFrameNumbers(manifest.playerRun.key, { start: 0, end: playerRunEndFrame }),
      frameRate: 16,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-player-jump')) {
    scene.anims.create({
      key: 'game-one-player-jump',
      frames: scene.anims.generateFrameNumbers(manifest.playerJump.key, { start: 0, end: playerJumpEndFrame }),
      frameRate: 10,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-ghost-float')) {
    scene.anims.create({
      key: 'game-one-ghost-float',
      frames: scene.anims.generateFrameNumbers(manifest.ghost.key, { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-caster-idle')) {
    scene.anims.create({
      key: 'game-one-caster-idle',
      frames: scene.anims.generateFrameNumbers(manifest.projectileCaster.key, { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-hunter-hover')) {
    scene.anims.create({
      key: 'game-one-hunter-hover',
      frames: scene.anims.generateFrameNumbers(manifest.hunterEnemy.key, { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-boss-idle')) {
    scene.anims.create({
      key: 'game-one-boss-idle',
      frames: scene.anims.generateFrameNumbers(manifest.bossEnemy.key, { start: 0, end: 7 }),
      frameRate: 9,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-projectile-float')) {
    scene.anims.create({
      key: 'game-one-projectile-float',
      frames: scene.anims.generateFrameNumbers(manifest.enemyProjectile.key, { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-boss-projectile-float')) {
    scene.anims.create({
      key: 'game-one-boss-projectile-float',
      frames: scene.anims.generateFrameNumbers(manifest.bossProjectile.key, { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-coin-spin')) {
    scene.anims.create({
      key: 'game-one-coin-spin',
      frames: scene.anims.generateFrameNumbers(manifest.coin.key, { start: 0, end: 6 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-portal-spin')) {
    scene.anims.create({
      key: 'game-one-portal-spin',
      frames: scene.anims.generateFrameNumbers(manifest.portal.key, { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
  }

  if (!scene.anims.exists('game-one-slime-move')) {
    scene.anims.create({
      key: 'game-one-slime-move',
      frames: [{ key: manifest.slimeGreen.key }],
      frameRate: 1,
      repeat: -1,
    });
  }
};

export const freezeAnimatedObject = (gameObject, frame = 0) => {
  if (!gameObject) {
    return;
  }

  if (gameObject.hoverTween?.stop) {
    gameObject.hoverTween.stop();
    gameObject.hoverTween = null;
  }

  if (gameObject.scene?.tweens) {
    gameObject.scene.tweens.killTweensOf(gameObject);
  }

  if (gameObject.anims) {
    try {
      gameObject.anims.stop();
    } catch (error) {
      // Some game objects may not have an active animation to stop.
    }
  }

  if (typeof gameObject.setFrame === 'function') {
    gameObject.setFrame(frame);
  }

  if (typeof gameObject.setVelocity === 'function') {
    gameObject.setVelocity(0, 0);
  }

  if (typeof gameObject.setAlpha === 'function' && gameObject.alpha === 0) {
    gameObject.setAlpha(1);
  }
};
