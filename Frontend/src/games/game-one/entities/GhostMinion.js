import Phaser from 'phaser';

export default class GhostMinion extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest, config = {}) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.spawnX = x;
    this.spawnY = y;
    this.speed = Number(config.speed || manifest.speed || 72);
    this.patrolDistance = Number(config.patrolDistance || 180);
    this.movementDirection = typeof config.movementDirection === 'string'
      ? config.movementDirection.trim().toUpperCase()
      : 'LEFT';
    this.axis = ['UP', 'DOWN'].includes(this.movementDirection) ? 'y' : 'x';
    this.direction = ['RIGHT', 'DOWN'].includes(this.movementDirection) ? 1 : -1;

    this.setScale(manifest.scale);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(manifest.body.width, manifest.body.height);
    this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);
    this.anims.play('game-one-ghost-float', true);
  }

  update() {
    if (this.axis === 'y') {
      this.setVelocityX(0);
      this.setVelocityY(this.speed * this.direction);

      if (this.y >= this.spawnY + this.patrolDistance) {
        this.direction = -1;
      } else if (this.y <= this.spawnY - this.patrolDistance) {
        this.direction = 1;
      }
      return;
    }

    this.setVelocityY(0);
    this.setVelocityX(this.speed * this.direction);
    this.setFlipX(this.direction < 0);

    if (this.x >= this.spawnX + this.patrolDistance) {
      this.direction = -1;
    } else if (this.x <= this.spawnX - this.patrolDistance) {
      this.direction = 1;
    }
  }
}
