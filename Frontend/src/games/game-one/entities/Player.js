import Phaser from 'phaser';

const MOVE_SPEED = 230;
const JUMP_VELOCITY = -720;
const DASH_SPEED = 760;
const DASH_DURATION_MS = 160;
const DASH_TILT_DEGREES = 13;
const WIND_SPAWN_INTERVAL_MS = 34;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.manifest = manifest;
    this.facing = 1;
    this.isFrozen = false;
    this.airDashUsed = false;
    this.isDashing = false;
    this.dashEndsAt = 0;
    this.lastWindLineAt = 0;

    this.setScale(manifest.scale);
    this.setCollideWorldBounds(true);
    this.body.setSize(manifest.body.width, manifest.body.height);
    this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);
    this.anims.play('game-one-player-idle', true);
  }

  freeze(shouldFreeze) {
    this.isFrozen = shouldFreeze;

    if (shouldFreeze) {
      this.stopDash();
      this.setVelocity(0, 0);
      this.anims.pause();
      return;
    }

    this.anims.resume();
  }

  isOnGround() {
    return Boolean(this.body?.blocked.down || this.body?.touching.down);
  }

  startAirDash() {
    this.airDashUsed = true;
    this.isDashing = true;
    this.dashEndsAt = this.scene.time.now + DASH_DURATION_MS;
    this.lastWindLineAt = 0;

    this.body.setAllowGravity(false);
    this.setVelocity(this.facing * DASH_SPEED, 0);
    this.setAngle(this.facing * DASH_TILT_DEGREES);
  }

  stopDash() {
    if (!this.isDashing) {
      return;
    }

    this.isDashing = false;
    this.dashEndsAt = 0;
    this.body.setAllowGravity(true);
    this.setAngle(0);
  }

  spawnDashWindLine(now) {
    if (this.lastWindLineAt && now - this.lastWindLineAt < WIND_SPAWN_INTERVAL_MS) {
      return;
    }

    this.lastWindLineAt = now;

    const windLine = this.scene.add.rectangle(
      this.x - (this.facing * Phaser.Math.Between(16, 30)),
      this.y + Phaser.Math.Between(-10, 10),
      Phaser.Math.Between(16, 30),
      3,
      0xe2e8f0,
      0.85,
    );

    windLine.setDepth(this.depth - 1);

    this.scene.tweens.add({
      targets: windLine,
      x: windLine.x - (this.facing * Phaser.Math.Between(20, 36)),
      alpha: 0,
      scaleX: 0.35,
      duration: 140,
      ease: 'Quad.Out',
      onComplete: () => windLine.destroy(),
    });
  }

  update(intent) {
    if (this.isFrozen) {
      return;
    }

    const now = this.scene.time.now;
    let onGround = this.isOnGround();

    if (onGround) {
      this.airDashUsed = false;
      this.stopDash();
    }

    if (intent.dashPressed && !onGround && !this.airDashUsed && !this.isDashing) {
      this.startAirDash();
    }

    if (this.isDashing) {
      if (now >= this.dashEndsAt) {
        this.stopDash();
      } else {
        this.setVelocity(this.facing * DASH_SPEED, 0);
        this.spawnDashWindLine(now);
        this.anims.play('game-one-player-jump', true);
        return;
      }
    }

    const horizontalDirection = Number(Boolean(intent.right)) - Number(Boolean(intent.left));

    if (horizontalDirection !== 0) {
      this.setVelocityX(horizontalDirection * MOVE_SPEED);

      if (horizontalDirection !== this.facing) {
        this.setFlipX(horizontalDirection < 0);
        this.facing = horizontalDirection;
      }
    } else {
      this.setVelocityX(0);
    }

    if (intent.jumpPressed && onGround) {
      this.setVelocityY(JUMP_VELOCITY);
      onGround = false;

      if (this.scene.sound && this.scene.manifest?.sounds?.jump) {
        const jumpSoundKey = this.scene.manifest.sounds.jump.key;
        if (this.scene.cache.audio.exists(jumpSoundKey)) {
          this.scene.sound.play(jumpSoundKey, { volume: this.scene.manifest.sounds.jump.volume || 0.5 });
        }
      }
    }

    if (!onGround) {
      this.anims.play('game-one-player-jump', true);
      return;
    }

    if (Math.abs(this.body.velocity.x) > 5) {
      this.anims.play('game-one-player-run', true);
      return;
    }

    this.anims.play('game-one-player-idle', true);
  }
}
