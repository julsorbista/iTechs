import Phaser from 'phaser';

export default class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest, config = {}) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.direction = Number(config.direction) < 0 ? -1 : 1;
    this.speed = Number(config.speed || manifest.speed || 280);
    this.lifetimeMs = Number(config.lifetimeMs || manifest.lifetimeMs || 2600);
    this.spawnedAt = scene.time.now;
    this.boundsLeft = Number(config.boundsLeft ?? -140);
    this.boundsRight = Number(config.boundsRight ?? Number(config.viewportWidth || 1280));
    this.animationKey = typeof config.animationKey === 'string' && config.animationKey.trim()
      ? config.animationKey.trim()
      : 'game-one-projectile-float';

    this.setScale(manifest.scale);
    this.setFlipX(this.direction < 0);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(manifest.body.width, manifest.body.height);
    this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);
    this.setVelocityX(this.speed * this.direction);

    if (scene.anims.exists(this.animationKey)) {
      this.anims.play(this.animationKey, true);
    }
  }

  update(time) {
    if (!this.active) {
      return;
    }

    if (
      time - this.spawnedAt >= this.lifetimeMs
      || this.x < this.boundsLeft - 140
      || this.x > this.boundsRight + 140
    ) {
      this.destroyProjectile();
    }
  }

  destroyProjectile() {
    if (!this.active) {
      return;
    }

    this.destroy();
  }
}
