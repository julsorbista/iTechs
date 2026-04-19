import Phaser from 'phaser';
import { registerGameOneAnimations } from '../systems/animations';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const bootPayload = this.game.__ITECHS_BOOT__ || {};
    const runtimeAssets = bootPayload.runtimeAssets;
    const runtimeLevelData = bootPayload.levelData || {};

    this.cameras.main.setBackgroundColor('#0f172a');

    const loadingLabel = this.add.text(640, 320, 'Loading Game 1...', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#f8fafc'
    }).setOrigin(0.5);

    const loadingSubtext = this.add.text(640, 364, 'Preparing rooms, monsters, and question gates.', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#cbd5e1'
    }).setOrigin(0.5);

    const progressBar = this.add.rectangle(640, 420, 0, 18, 0x34d399).setOrigin(0.5);
    const progressFrame = this.add.rectangle(640, 420, 420, 24).setStrokeStyle(3, 0xf8fafc).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.width = 412 * value;
    });

    this.load.on('complete', () => {
      loadingLabel.destroy();
      loadingSubtext.destroy();
      progressBar.destroy();
      progressFrame.destroy();
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

    const dynamicBackgroundTiles = Array.isArray(runtimeLevelData?.worldObjects?.backgroundTiles)
      ? runtimeLevelData.worldObjects.backgroundTiles
      : [];
    const queuedTextureKeys = new Set();

    dynamicBackgroundTiles.forEach((tile, index) => {
      const imageUrl = typeof tile?.imageUrl === 'string' ? tile.imageUrl.trim() : '';
      if (!imageUrl) {
        return;
      }

      const textureKey = typeof tile?.textureKey === 'string' && tile.textureKey.trim()
        ? tile.textureKey.trim()
        : `room-bg-tile-${index + 1}`;

      if (queuedTextureKeys.has(textureKey) || this.textures.exists(textureKey)) {
        return;
      }

      queuedTextureKeys.add(textureKey);
      this.load.image(textureKey, imageUrl);
    });
  }

  create() {
    const { manifest } = this.game.__ITECHS_BOOT__.runtimeAssets;
    registerGameOneAnimations(this, manifest);

    this.scene.launch('HudScene');
    this.scene.launch('MenuScene');
    this.scene.start('LevelScene');
  }
}
