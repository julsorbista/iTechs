import Phaser from 'phaser';

const normalizeDirection = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();

    if (normalized === 'LEFT') {
      return -1;
    }

    if (normalized === 'RIGHT') {
      return 1;
    }
  }

  return Number(value) < 0 ? -1 : 1;
};

export default class ProjectileCaster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest, config = {}) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.manifest = manifest;
    this.enemyType = typeof config.enemyType === 'string' && config.enemyType.trim()
      ? config.enemyType.trim().toLowerCase()
      : 'elemental';
    this.fireDirection = normalizeDirection(config.fireDirection);
    this.fireIntervalMs = Number(config.fireIntervalMs || manifest.fireIntervalMs || 1800);
    this.projectileSpeed = Number(config.projectileSpeed || manifest.projectileSpeed || 280);
    this.projectileLifetimeMs = Number(config.projectileLifetimeMs || manifest.projectileLifetimeMs || 2600);
    this.projectileManifest = config.projectileManifest || null;
    this.projectileAnimationKey = typeof config.projectileAnimationKey === 'string' && config.projectileAnimationKey.trim()
      ? config.projectileAnimationKey.trim()
      : 'game-one-projectile-float';
    this.projectileOffsetX = Number(
      config.projectileOffsetX ?? (this.fireDirection * (manifest.projectileOffsetX || 44))
    );
    this.projectileOffsetY = Number(config.projectileOffsetY ?? (manifest.projectileOffsetY || 8));
    this.warningLeadMs = Number(config.warningLeadMs || 360);
    this.nextShotAt = scene.time.now + Number(config.initialDelayMs ?? this.fireIntervalMs);
    this.maxHitPoints = Math.max(1, Number(config.hitPoints || manifest.hitPoints || (this.enemyType === 'boss' ? 8 : 1)));
    this.hitPoints = this.maxHitPoints;
    this.spawnY = y;
    this.spawnX = x;
    this.floatAmplitude = Number(config.floatAmplitude ?? manifest.driftAmplitude ?? (this.enemyType === 'hunter' ? 36 : 8));
    this.floatSpeed = Number(config.floatSpeed ?? manifest.driftSpeed ?? (this.enemyType === 'hunter' ? 1.8 : 1.1));
    this.floatSeed = Number(config.floatSeed ?? (x * 0.01));

    this.setScale(Number(config.scale ?? manifest.scale));
    this.setFlipX(this.fireDirection < 0);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(manifest.body.width, manifest.body.height);
    this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);

    const animationKey = this.enemyType === 'hunter'
      ? 'game-one-hunter-hover'
      : (this.enemyType === 'boss' ? 'game-one-boss-idle' : 'game-one-caster-idle');
    if (scene.anims.exists(animationKey)) {
      this.anims.play(animationKey, true);
    }

    if (this.enemyType === 'boss') {
      this.setTint(0xfda4af);
    }
  }

  update(time) {
    if (!this.active) {
      return;
    }

    if (this.floatAmplitude > 0) {
      const wave = Math.sin((time * 0.001 * this.floatSpeed) + this.floatSeed);
      this.setY(this.spawnY + (wave * this.floatAmplitude));
    }

    if (time >= this.nextShotAt - this.warningLeadMs) {
      if (this.enemyType === 'boss') {
        this.setTint(0xfb7185);
      } else {
        this.setTint(0xfacc15);
      }
      return;
    }

    if (this.enemyType === 'boss') {
      this.setTint(0xfda4af);
      return;
    }

    if (this.enemyType === 'hunter') {
      this.setTint(0x7dd3fc);
      return;
    }

    this.clearTint();
  }

  shouldFire(time) {
    return this.active && time >= this.nextShotAt;
  }

  consumeShot(time) {
    this.nextShotAt = time + this.fireIntervalMs;
    if (this.enemyType === 'boss') {
      this.setTint(0xfda4af);
      return;
    }

    if (this.enemyType === 'hunter') {
      this.setTint(0x7dd3fc);
      return;
    }

    this.clearTint();
  }

  getShotSpawnPoint() {
    return {
      x: this.x + this.projectileOffsetX,
      y: this.y + this.projectileOffsetY,
    };
  }

  applyProjectileHit(damage = 1) {
    if (!this.active) {
      return false;
    }

    this.hitPoints = Math.max(0, this.hitPoints - Math.max(1, Number(damage || 1)));

    if (this.hitPoints <= 0) {
      this.destroy();
      return true;
    }

    this.setTint(0xfef08a);
    this.scene.time.delayedCall(90, () => {
      if (!this.active) {
        return;
      }

      if (this.enemyType === 'boss') {
        this.setTint(0xfda4af);
      } else if (this.enemyType === 'hunter') {
        this.setTint(0x7dd3fc);
      } else {
        this.clearTint();
      }
    });

    return false;
  }
}
