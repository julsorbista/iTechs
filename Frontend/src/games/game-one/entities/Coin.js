import Phaser from 'phaser';

export default class Coin extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, manifest) {
    super(scene, x, y, manifest.key, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.manifest = manifest;
    this.setScale(manifest.scale);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.anims.play('game-one-coin-spin', true);
  }

  playCoinSound() {
    if (this.scene.sound && this.scene.manifest?.sounds?.coin) {
      const coinSoundKey = this.scene.manifest.sounds.coin.key;
      if (this.scene.cache.audio.exists(coinSoundKey)) {
        this.scene.sound.play(coinSoundKey, { 
          volume: this.scene.manifest.sounds.coin.volume || 0.7 
        });
      }
    }
  }
}
