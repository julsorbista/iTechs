import Phaser from 'phaser';

export default class EditorBootScene extends Phaser.Scene {
  constructor() {
    super('GameOneEditorBootScene');
  }

  create() {
    this.scene.start('GameOneEditorPreloadScene');
  }
}
