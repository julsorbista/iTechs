import Phaser from 'phaser';
import { registerGameOneAnimations } from '../systems/animations';

export default class EditorPreloadScene extends Phaser.Scene {
  constructor() {
    super('GameOneEditorPreloadScene');
  }

  preload() {
    const runtimeAssets = this.game.__ITECHS_EDITOR__?.runtimeAssets;

    this.cameras.main.setBackgroundColor('#0f172a');

    const label = this.add.text(640, 344, 'Preparing editor canvas...', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#f8fafc',
    }).setOrigin(0.5);

    const progress = this.add.rectangle(640, 392, 0, 14, 0x34d399).setOrigin(0.5);
    const frame = this.add.rectangle(640, 392, 360, 18).setStrokeStyle(2, 0xf8fafc).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progress.width = 352 * value;
    });

    this.load.on('complete', () => {
      label.destroy();
      progress.destroy();
      frame.destroy();
    });

    runtimeAssets.images.forEach((asset) => {
      this.load.image(asset.key, asset.url);
    });

    runtimeAssets.spritesheets.forEach((asset) => {
      this.load.spritesheet(asset.key, asset.url, asset.frameConfig);
    });

    (runtimeAssets.audio || []).forEach((asset) => {
      this.load.audio(asset.key, asset.url);
    });
  }

  create() {
    const { manifest } = this.game.__ITECHS_EDITOR__.runtimeAssets;
    registerGameOneAnimations(this, manifest);
    this.scene.start('GameOneEditorScene');
  }
}
