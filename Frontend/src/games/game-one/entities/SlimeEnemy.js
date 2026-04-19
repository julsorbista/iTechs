import Phaser from 'phaser';

const GRAVITY_SCALE = 0.8;
const DIRECTION_CHANGE_INTERVAL_MS = 2000;
const JUMP_FORCE = -420;

export default class SlimeEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest, config = {}) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.manifest = manifest;
    this.speed = manifest.speed || 60;
    this.direction = config.direction || 1;
    this.lastDirectionChangeAt = 0;
    this.nextJumpAt = 0;

    this.setScale(manifest.scale);
    this.body.setGravityY(GRAVITY_SCALE);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.4, 0.4);
    
    if (manifest.body) {
      this.body.setSize(manifest.body.width, manifest.body.height);
      this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);
    }

    if (scene.anims.exists('game-one-slime-move')) {
      this.anims.play('game-one-slime-move', true);
    }
  }

  update(now) {
    if (!this.active || !this.body) return;

    if (now - this.lastDirectionChangeAt > DIRECTION_CHANGE_INTERVAL_MS) {
      this.lastDirectionChangeAt = now;
      this.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
      this.nextJumpAt = now + Phaser.Math.Between(400, 800);
    }

    this.setVelocityX(this.direction * this.speed);

    if (now >= this.nextJumpAt && (this.body.blocked.down || this.body.touching.down)) {
      this.setVelocityY(JUMP_FORCE);
      this.nextJumpAt = now + DIRECTION_CHANGE_INTERVAL_MS;
    }

    this.setFlipX(this.direction < 0);
  }
}
