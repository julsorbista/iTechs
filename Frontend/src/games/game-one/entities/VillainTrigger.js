import Phaser from 'phaser';

export default class VillainTrigger extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest, config = {}) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.questionId = config.questionId || null;
    this.appearance = config.appearance === 'STATUE' ? 'STATUE' : 'VILLAIN';
    this.interactionLabel = config.interactionLabel || (this.appearance === 'STATUE' ? 'statue' : 'villain');
    this.questionState = 'UNANSWERED';
    this.hoverTween = null;
    this.hasVanished = false;
    this.pedestal = this.appearance === 'STATUE'
      ? scene.add.rectangle(x, y + 56, 112, 20, 0x334155, 0.96).setStrokeStyle(2, 0x94a3b8, 0.9)
      : null;
    this.pedestalCap = this.appearance === 'STATUE'
      ? scene.add.rectangle(x, y + 46, 78, 12, 0x64748b, 0.96).setStrokeStyle(2, 0xcbd5e1, 0.85)
      : null;
    this.statusBack = this.appearance === 'STATUE'
      ? null
      : scene.add.circle(x, y - 74, 18, 0x1d4ed8, 0.92);
    this.statusBack?.setStrokeStyle(2, 0xf8fafc, 0.95);
    this.statusLabel = this.appearance === 'STATUE'
      ? null
      : scene.add.text(x, y - 74, '?', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f8fafc'
      }).setOrigin(0.5);

    this.setScale(manifest.scale);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(manifest.body.width, manifest.body.height);
    this.body.setOffset(manifest.body.offsetX, manifest.body.offsetY);
    this.pedestal?.setDepth(this.depth - 0.5);
    this.pedestalCap?.setDepth(this.depth - 0.45);
    this.statusBack?.setDepth(this.depth + 0.5);
    this.statusLabel?.setDepth(this.depth + 0.6);
    this.playHoverLoop();
    this.setQuestionState('UNANSWERED', { animate: false });

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.tweens.killTweensOf([
        this,
        this.statusBack,
        this.statusLabel,
        this.pedestal,
        this.pedestalCap
      ].filter(Boolean));
      this.statusBack?.destroy();
      this.statusLabel?.destroy();
      this.pedestal?.destroy();
      this.pedestalCap?.destroy();
    });
  }

  playHoverLoop() {
    this.hoverTween?.stop();

    if (this.appearance === 'STATUE') {
      return;
    }

    this.hoverTween = this.scene.tweens.add({
      targets: [this, this.statusBack, this.statusLabel],
      y: '-=8',
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  createStatueVanishBurst() {
    const flash = this.scene.add.circle(this.x, this.y - 10, 18, 0xf8fafc, 0.3);
    flash.setStrokeStyle(3, 0xe2e8f0, 0.82);
    flash.setDepth(this.depth + 1.2);

    this.scene.tweens.add({
      targets: flash,
      scaleX: 4.2,
      scaleY: 2.6,
      alpha: 0,
      duration: 320,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy()
    });

    [
      { x: -52, y: -36, radius: 4, delay: 0 },
      { x: -24, y: -58, radius: 5, delay: 20 },
      { x: 18, y: -62, radius: 4, delay: 36 },
      { x: 48, y: -32, radius: 5, delay: 54 },
      { x: -42, y: 6, radius: 3, delay: 72 },
      { x: 40, y: 10, radius: 3, delay: 90 }
    ].forEach((fragment) => {
      const dust = this.scene.add.circle(this.x, this.y - 8, fragment.radius, 0xe2e8f0, 0.84);
      dust.setDepth(this.depth + 1.1);

      this.scene.tweens.add({
        targets: dust,
        x: this.x + fragment.x,
        y: (this.y - 8) + fragment.y,
        alpha: 0,
        scaleX: 0.24,
        scaleY: 0.24,
        delay: fragment.delay,
        duration: 320,
        ease: 'Quad.Out',
        onComplete: () => dust.destroy()
      });
    });
  }

  hideAsCleared() {
    if (this.body) {
      this.body.enable = false;
    }

    this.hasVanished = true;
    this.setVisible(false);
    this.setAlpha(0);
    [this.statusBack, this.statusLabel, this.pedestal, this.pedestalCap]
      .filter(Boolean)
      .forEach((object) => object.setVisible(false));
  }

  playStatueVanish() {
    if (this.hasVanished) {
      return;
    }

    this.hasVanished = true;
    this.hoverTween?.stop();
    this.hoverTween = null;

    if (this.body) {
      this.body.enable = false;
    }

    this.createStatueVanishBurst();

    this.scene.tweens.add({
      targets: [this, this.statusBack, this.statusLabel].filter(Boolean),
      y: '-=22',
      alpha: 0,
      scaleX: 0.72,
      scaleY: 1.18,
      duration: 280,
      ease: 'Quad.Out'
    });

    this.scene.tweens.add({
      targets: [this.pedestal, this.pedestalCap].filter(Boolean),
      y: '+=14',
      alpha: 0,
      duration: 240,
      ease: 'Quad.In',
      onComplete: () => this.hideAsCleared()
    });
  }

  setQuestionState(state, { animate = true } = {}) {
    this.questionState = state === 'ANSWERED' ? 'ANSWERED' : 'UNANSWERED';

    if (this.questionState === 'ANSWERED') {
      if (this.appearance === 'STATUE') {
        if (animate) {
          this.playStatueVanish();
        } else {
          this.hideAsCleared();
        }
        return;
      }

      this.setTint(0x86efac);
      this.statusBack.setFillStyle(0x166534, 0.94);
      this.statusLabel.setText('OK');
      return;
    }

    this.hasVanished = false;
    this.setVisible(true);
    this.setAlpha(1);
    if (this.body) {
      this.body.enable = true;
    }

    [this.statusBack, this.statusLabel, this.pedestal, this.pedestalCap]
      .filter(Boolean)
      .forEach((object) => {
        object.setVisible(true);
        object.setAlpha(1);
        object.setScale(1);
      });

    if (this.appearance === 'STATUE') {
      this.setTint(0xcbd5e1);
      return;
    }

    this.setTint(0xfbbf24);
    this.statusBack.setFillStyle(0x1d4ed8, 0.92);
    this.statusLabel.setText('?');
    this.statusLabel.setColor('#f8fafc');
  }
}
