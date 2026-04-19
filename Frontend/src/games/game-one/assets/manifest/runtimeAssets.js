import assetManifest from './assetManifest.json';

const tutorialGrove = new URL('../processed/backgrounds/tutorial-grove.png', import.meta.url).href;
const swampTrail = new URL('../processed/backgrounds/swamp-trail.png', import.meta.url).href;
const ruinsGate = new URL('../processed/backgrounds/ruins-gate.png', import.meta.url).href;
const room1Background = new URL('../../../../../assets/Game/game_one/Background/room 1.JPG', import.meta.url).href;
const room3Background = new URL('../../../../../assets/Game/game_one/Background/room 3.JPG', import.meta.url).href;
const room6Background = new URL('../../../../../assets/Game/game_one/Background/room 6.JPG', import.meta.url).href;
const room10Background = new URL('../../../../../assets/Game/game_one/Background/room 10.JPG', import.meta.url).href;
const playerIdleSheet = new URL('../processed/player/blue-wizard-idle-sheet.png', import.meta.url).href;
const playerRunSheet = new URL('../processed/player/blue-wizard-walk-sheet.png', import.meta.url).href;
const playerJumpSheet = new URL('../processed/player/blue-wizard-jump-sheet.png', import.meta.url).href;
const gameOneBackgroundMusic = new URL('../../../../../assets/Game/game_one/Music & Sound Effects/bg_sound/game_one/game1_sound1.mp3', import.meta.url).href;
const gameOneBackgroundMusic2 = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/music/time_for_adventure.mp3', import.meta.url).href;
const ghostSheet = new URL('../processed/sprites/ghost-sheet.png', import.meta.url).href;
const elementalCasterSheet = new URL('../processed/sprites/elemental-caster-sheet.png', import.meta.url).href;
const hunterEnemySheet = new URL('../processed/sprites/hunter-drone-sheet.svg', import.meta.url).href;
const bossEnemySheet = new URL('../processed/sprites/boss-sentinel-sheet.svg', import.meta.url).href;
const enemyProjectileSheet = new URL('../processed/sprites/enemy-projectile-sheet.png', import.meta.url).href;
const bossProjectileSheet = new URL('../processed/sprites/boss-projectile-sheet.svg', import.meta.url).href;
const coinSheet = new URL('../processed/sprites/coin-sheet.png', import.meta.url).href;
const portalSheet = new URL('../processed/sprites/portal-sheet.png', import.meta.url).href;
const villainIdle = new URL('../processed/sprites/villain-idle.png', import.meta.url).href;
const platformGrass = new URL('../processed/platforms/platform-grass.png', import.meta.url).href;
const platformStone = new URL('../processed/platforms/platform-stone.png', import.meta.url).href;
const platformWood = new URL('../processed/platforms/platform-wood.png', import.meta.url).href;

// Sound files
const soundCoin = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sounds/coin.wav', import.meta.url).href;
const soundExplosion = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sounds/explosion.wav', import.meta.url).href;
const soundHurt = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sounds/hurt.wav', import.meta.url).href;
const soundJump = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sounds/jump.wav', import.meta.url).href;
const soundPowerUp = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sounds/power_up.wav', import.meta.url).href;
const soundTap = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sounds/tap.wav', import.meta.url).href;

const slimeGreenSprite = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sprites/slime_green.png', import.meta.url).href;
const slimePurpleSprite = new URL('../../../../../assets/Game/game_one/brackeys_platformer_assets/sprites/slime_purple.png', import.meta.url).href;

export const gameOneRuntimeAssets = {
  backgroundMusicKey: 'gameOneBackgroundMusic',
  manifest: assetManifest,
  images: [
    { key: assetManifest.backgrounds.tutorialGrove.key, url: tutorialGrove },
    { key: assetManifest.backgrounds.swampTrail.key, url: swampTrail },
    { key: assetManifest.backgrounds.ruinsGate.key, url: ruinsGate },
    { key: assetManifest.backgrounds.room_1.key, url: room1Background },
    { key: assetManifest.backgrounds.room_3.key, url: room3Background },
    { key: assetManifest.backgrounds.room_6.key, url: room6Background },
    { key: assetManifest.backgrounds.room_10.key, url: room10Background },
    { key: assetManifest.villain.key, url: villainIdle },
    { key: assetManifest.platforms.grass.key, url: platformGrass },
    { key: assetManifest.platforms.stone.key, url: platformStone },
    { key: assetManifest.platforms.wood.key, url: platformWood },
    { key: assetManifest.slimeGreen.key, url: slimeGreenSprite },
    { key: assetManifest.slimePurple.key, url: slimePurpleSprite }
  ],
  spritesheets: [
    { key: assetManifest.player.key, url: playerIdleSheet, frameConfig: { frameWidth: assetManifest.player.frameWidth, frameHeight: assetManifest.player.frameHeight } },
    { key: assetManifest.playerRun.key, url: playerRunSheet, frameConfig: { frameWidth: assetManifest.playerRun.frameWidth, frameHeight: assetManifest.playerRun.frameHeight } },
    { key: assetManifest.playerJump.key, url: playerJumpSheet, frameConfig: { frameWidth: assetManifest.playerJump.frameWidth, frameHeight: assetManifest.playerJump.frameHeight } },
    { key: assetManifest.ghost.key, url: ghostSheet, frameConfig: { frameWidth: assetManifest.ghost.frameWidth, frameHeight: assetManifest.ghost.frameHeight } },
    { key: assetManifest.projectileCaster.key, url: elementalCasterSheet, frameConfig: { frameWidth: assetManifest.projectileCaster.frameWidth, frameHeight: assetManifest.projectileCaster.frameHeight } },
    { key: assetManifest.hunterEnemy.key, url: hunterEnemySheet, frameConfig: { frameWidth: assetManifest.hunterEnemy.frameWidth, frameHeight: assetManifest.hunterEnemy.frameHeight } },
    { key: assetManifest.bossEnemy.key, url: bossEnemySheet, frameConfig: { frameWidth: assetManifest.bossEnemy.frameWidth, frameHeight: assetManifest.bossEnemy.frameHeight } },
    { key: assetManifest.enemyProjectile.key, url: enemyProjectileSheet, frameConfig: { frameWidth: assetManifest.enemyProjectile.frameWidth, frameHeight: assetManifest.enemyProjectile.frameHeight } },
    { key: assetManifest.bossProjectile.key, url: bossProjectileSheet, frameConfig: { frameWidth: assetManifest.bossProjectile.frameWidth, frameHeight: assetManifest.bossProjectile.frameHeight } },
    { key: assetManifest.coin.key, url: coinSheet, frameConfig: { frameWidth: assetManifest.coin.frameWidth, frameHeight: assetManifest.coin.frameHeight } },
    { key: assetManifest.portal.key, url: portalSheet, frameConfig: { frameWidth: assetManifest.portal.frameWidth, frameHeight: assetManifest.portal.frameHeight } }
  ],
  audio: [
    { key: 'gameOneBackgroundMusic', url: gameOneBackgroundMusic },
    { key: assetManifest.sounds.backgroundTrack2.key, url: gameOneBackgroundMusic2 },
    { key: assetManifest.sounds.coin.key, url: soundCoin },
    { key: assetManifest.sounds.explosion.key, url: soundExplosion },
    { key: assetManifest.sounds.hurt.key, url: soundHurt },
    { key: assetManifest.sounds.jump.key, url: soundJump },
    { key: assetManifest.sounds.powerUp.key, url: soundPowerUp },
    { key: assetManifest.sounds.tap.key, url: soundTap }
  ]
};

export default gameOneRuntimeAssets;
