import Phaser from 'phaser';

export default class Portal extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest, config = {}) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.manifest = manifest;
    this.targetRoomId = config.targetRoomId || null;
    this.endsLevel = Boolean(config.endsLevel);
    this.questionId = config.questionId || null;
    this.linkName = typeof config.linkName === 'string' ? config.linkName.trim() : '';
    this.locked = Boolean(config.locked);
    this.lockLayers = [];

    const createLockLayer = (gameObject, baseAlpha) => {
      gameObject.baseAlpha = baseAlpha;
      gameObject.setAlpha(baseAlpha);
      return gameObject;
    };

    this.lockLayers = [
      createLockLayer(scene.add.ellipse(x, y + 8, 84, 132, 0x111827, 0.82), 0.82),
      createLockLayer(scene.add.ellipse(x, y + 8, 50, 94, 0x374151, 0.94), 0.94),
      createLockLayer(scene.add.rectangle(x - 14, y + 8, 7, 30, 0x9ca3af, 0.82), 0.82),
      createLockLayer(scene.add.rectangle(x + 14, y + 8, 7, 30, 0x9ca3af, 0.82), 0.82),
      createLockLayer(scene.add.rectangle(x, y - 16, 24, 7, 0x9ca3af, 0.82), 0.82),
      createLockLayer(scene.add.rectangle(x, y + 32, 24, 7, 0x9ca3af, 0.82), 0.82),
    ];

    this.setScale(manifest.scale);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(manifest.body.width, manifest.body.height);
    this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);

    this.lockLayers.forEach((layer, index) => {
      layer.setDepth(this.depth + 1 + (index * 0.01));
    });

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf([this, ...this.lockLayers]);
      this.lockLayers.forEach((layer) => layer?.destroy());
    });

    this.syncVisualState();
  }

  syncVisualState() {
    this.scene.tweens.killTweensOf([this, ...this.lockLayers]);

    if (this.locked) {
      this.anims.stop();
      this.setFrame(0);
      this.setAlpha(0.82);
      this.setScale(this.manifest.scale * 0.96);
      this.setTint(0x9ca3af);
      this.lockLayers.forEach((layer) => {
        layer.setVisible(true);
        layer.setAlpha(layer.baseAlpha);
        layer.setScale(1);
      });
      return;
    }

    this.clearTint();
    this.setAlpha(1);
    this.setScale(this.manifest.scale);
    this.anims.play('game-one-portal-spin', true);
    this.lockLayers.forEach((layer) => {
      layer.setVisible(false);
      layer.setAlpha(layer.baseAlpha);
      layer.setScale(1);
    });
  }

  playUnlockEffect() {
    this.lockLayers.forEach((layer) => {
      layer.setVisible(true);
      layer.setAlpha(layer.baseAlpha);
      layer.setScale(1);
    });

    this.setAlpha(1);
    this.clearTint();
    this.setScale(this.manifest.scale * 0.92);
    this.anims.play('game-one-portal-spin', true);

    this.scene.tweens.add({
      targets: this,
      scaleX: this.manifest.scale,
      scaleY: this.manifest.scale,
      duration: 260,
      ease: 'Back.Out'
    });

    this.scene.tweens.add({
      targets: this.lockLayers,
      alpha: 0,
      scaleX: 1.24,
      scaleY: 0.84,
      duration: 260,
      ease: 'Quad.Out',
      onComplete: () => {
        this.lockLayers.forEach((layer) => {
          layer.setVisible(false);
          layer.setAlpha(layer.baseAlpha);
          layer.setScale(1);
        });
      }
    });
  }

  setLocked(locked) {
    const nextLocked = Boolean(locked);
    const wasLocked = this.locked;

    if (nextLocked === wasLocked) {
      return;
    }

    this.locked = nextLocked;

    if (wasLocked && !nextLocked) {
      this.playUnlockEffect();
      return;
    }

    this.syncVisualState();
  }

  isUnlocked() {
    return !this.locked;
  }
}
