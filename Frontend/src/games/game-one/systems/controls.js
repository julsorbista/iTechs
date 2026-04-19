import Phaser from 'phaser';

export const createControls = (scene) => {
  const cursors = scene.input.keyboard.createCursorKeys();
  const wasd = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    attack: Phaser.Input.Keyboard.KeyCodes.J,
  });

  return {
    cursors,
    wasd,
  };
};

export const readMovementIntent = (controls) => {
  const left = controls.cursors.left.isDown || controls.wasd.left.isDown;
  const right = controls.cursors.right.isDown || controls.wasd.right.isDown;
  const upPressed = Phaser.Input.Keyboard.JustDown(controls.cursors.up)
    || Phaser.Input.Keyboard.JustDown(controls.wasd.up);
  const spacePressed = Phaser.Input.Keyboard.JustDown(controls.cursors.space);
  const attackPressed = Phaser.Input.Keyboard.JustDown(controls.wasd.attack);
  const jumpPressed = upPressed || spacePressed;
  const dashPressed = spacePressed;

  return {
    left,
    right,
    jumpPressed,
    dashPressed,
    attackPressed,
  };
};

export const wasPausePressed = (controls) => Phaser.Input.Keyboard.JustDown(controls.wasd.pause);
