import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const sourceDir = path.join(projectRoot, 'assets/Game/game_one/brackeys_platformer_assets');
const soundsDestDir = path.join(projectRoot, 'src/games/game-one/assets/manifest');
const spritesDestDir = path.join(projectRoot, 'src/games/game-one/assets/processed/sprites');

// Ensure destination directories exist
[soundsDestDir, spritesDestDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy sounds
const soundsSourceDir = path.join(sourceDir, 'sounds');
if (fs.existsSync(soundsSourceDir)) {
  const soundFiles = fs.readdirSync(soundsSourceDir).filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
  soundFiles.forEach(file => {
    const src = path.join(soundsSourceDir, file);
    const dest = path.join(soundsDestDir, file);
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied sound: ${file}`);
  });
} else {
  console.warn(`⚠ Sounds directory not found: ${soundsSourceDir}`);
}

// Copy sprites
const spritesSourceDir = path.join(sourceDir, 'sprites');
if (fs.existsSync(spritesSourceDir)) {
  const spriteFiles = fs.readdirSync(spritesSourceDir).filter(f => 
    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
  );
  spriteFiles.forEach(file => {
    const src = path.join(spritesSourceDir, file);
    const dest = path.join(spritesDestDir, file);
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied sprite: ${file}`);
  });
} else {
  console.warn(`⚠ Sprites directory not found: ${spritesSourceDir}`);
}

console.log('\n✓ Asset copy complete!');
