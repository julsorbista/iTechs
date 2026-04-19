import Phaser from 'phaser';
import Player from '../entities/Player';
import Coin from '../entities/Coin';
import Portal from '../entities/Portal';
import GhostMinion from '../entities/GhostMinion';
import VillainTrigger from '../entities/VillainTrigger';
import ProjectileCaster from '../entities/ProjectileCaster';
import EnemyProjectile from '../entities/EnemyProjectile';
import { createControls, readMovementIntent, wasPausePressed } from '../systems/controls';
import { getGameOneSurfaceMetrics } from '../systems/rendering';
import { buildWorldGridLayout, getCellCount, getCellRecordAtWorldPoint, getCellWorldBounds, getQuestionById } from '../systems/roomFlow';
import { normalizeLevelData } from '../../../features/level-editor/levelEditorUtils';
import { getLevelEditorSource } from '../../../features/level-editor/levelEditorConfig';

const PASS_THROUGH_SIDES = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
const PLAYER_PROJECTILE_SPEED = 560;
const PLAYER_PROJECTILE_LIFETIME_MS = 1250;
const PLAYER_PROJECTILE_COOLDOWN_MS = 280;
const PLAYER_PROJECTILE_SCALE = 0.42;
const DANGER_SURGE_DURATION_MS = 7000;
const DEFAULT_ROOM_BACKGROUND_COLOR = '#111827';

const normalizeLevelSettings = (settings = {}) => {
  const playerHealth = Number(settings.playerHealth);
  const timerSeconds = Number(settings.timerSeconds);

  return {
    playerHealth: Number.isFinite(playerHealth) ? Phaser.Math.Clamp(Math.round(playerHealth), 1, 10) : 3,
    timerEnabled: Boolean(settings.timerEnabled),
    timerSeconds: Number.isFinite(timerSeconds) ? Phaser.Math.Clamp(Math.round(timerSeconds), 10, 3600) : 120,
  };
};

const normalizePassThroughSides = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : ''))
    .filter((entry) => PASS_THROUGH_SIDES.includes(entry));

  return Array.from(new Set(normalized));
};

const shouldSkipCollisionForPassThrough = (playerBody, platformBody, passThroughSides) => {
  if (!playerBody || !platformBody || passThroughSides.length === 0) {
    return false;
  }

  const previousLeft = playerBody.prev?.x ?? playerBody.x;
  const previousTop = playerBody.prev?.y ?? playerBody.y;
  const previousRight = previousLeft + playerBody.width;
  const previousBottom = previousTop + playerBody.height;

  if (passThroughSides.includes('TOP') && playerBody.velocity.y >= 0 && previousBottom <= platformBody.top + 12) {
    return true;
  }

  if (passThroughSides.includes('BOTTOM') && playerBody.velocity.y <= 0 && previousTop >= platformBody.bottom - 12) {
    return true;
  }

  if (passThroughSides.includes('LEFT') && playerBody.velocity.x >= 0 && previousRight <= platformBody.left + 12) {
    return true;
  }

  if (passThroughSides.includes('RIGHT') && playerBody.velocity.x <= 0 && previousLeft >= platformBody.right - 12) {
    return true;
  }

  return false;
};

export default class LevelScene extends Phaser.Scene {
  constructor() {
    super('LevelScene');
  }

  create() {
    const bootPayload = this.game.__ITECHS_BOOT__ || {};
    this.runtimeAssets = bootPayload.runtimeAssets;
    this.callbacks = bootPayload.callbacks || {};
    this.manifest = this.runtimeAssets.manifest;
    const source = getLevelEditorSource(bootPayload.levelData?.gameType || 'GAME_ONE') || { gameType: 'GAME_ONE', defaultLevelNumber: bootPayload.levelData?.levelNumber || 1, runtimeAssets: this.runtimeAssets };
    this.levelData = normalizeLevelData(bootPayload.levelData, { ...source, runtimeAssets: this.runtimeAssets });
    this.worldObjectsData = this.levelData.worldObjects || {};
    this.worldLayout = buildWorldGridLayout(this.levelData);

    this.controls = createControls(this);
    this.sceneObjects = [];
    this.ghosts = [];
    this.projectileCasters = [];
    this.bossEntities = [];
    this.projectiles = [];
    this.playerProjectiles = [];
    this.staticBodies = [];
    this.portals = [];
    this.portalsByLinkName = new Map();
    this.villains = [];
    this.questionBarriers = new Map();
    this.questionUnlockPlatforms = new Map();
    this.questionPortals = new Map();
    this.completedQuestions = new Set();
    this.requiredStatueQuestionIds = this.collectRequiredStatueQuestionIds();
    this.collectedCoinIds = new Set();
    this.totalCoins = (this.worldObjectsData.coins || []).length;
    this.coinGoal = this.resolveCoinGoal();
    this.levelSettings = normalizeLevelSettings(this.levelData?.settings);
    this.requireBossDefeat = Boolean(this.levelData?.settings?.requireBossDefeat);
    this.maxHealth = this.levelSettings.playerHealth;
    this.currentHealth = this.levelSettings.playerHealth;
    this.coinsCollected = 0;
    this.wrongAnswers = 0;
    this.isPaused = false;
    this.isInteractionLocked = false;
    this.hasFinished = false;
    this.damageCooldownUntil = 0;
    this.damageTween = null;
    this.questionCooldownUntil = 0;
    this.playerProjectileCooldownUntil = 0;
    this.playerShotsFired = 0;
    this.playerShotsHit = 0;
    this.dangerSurgeUntil = 0;
    this.dangerStateActive = false;
    this.lastStatueHintAt = 0;
    this.guidedStatue = null;
    this.objectiveLockUntil = 0;
    this.levelStartedAt = Date.now();
    this.timerEnabled = this.levelSettings.timerEnabled;
    this.remainingTimeMs = this.timerEnabled ? (this.levelSettings.timerSeconds * 1000) : 0;
    this.lastTimerSecond = null;
    this.currentCellRecord = this.worldLayout.cells[0] || null;
    this.backgroundMusic = null;

    this.physics.world.setBounds(this.worldLayout.bounds.left, this.worldLayout.bounds.top, this.worldLayout.bounds.width, this.worldLayout.bounds.height);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(this.worldLayout.bounds.left, this.worldLayout.bounds.top, this.worldLayout.bounds.width, this.worldLayout.bounds.height);
    this.cameras.main.fadeIn(260, 0, 0, 0);
    this.cameras.main.setRoundPixels(true);

    const spawnPoint = this.getSpawnPoint();
    this.player = new Player(this, spawnPoint.x, spawnPoint.y, this.manifest.player);
    this.cameras.main.centerOn(spawnPoint.x, spawnPoint.y);
    this.cameras.main.startFollow(this.player, true, 1, 1);

    this.events.on('question:answered', this.handleQuestionAnswered, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('question:answered', this.handleQuestionAnswered, this);
      this.stopBackgroundMusic();
      this.scene.stop('HudScene');
      this.scene.stop('QuestionScene');
    });

    this.registry.set('totalCoins', this.totalCoins);
    this.registry.set('coinsCollected', this.coinsCollected);
    this.registry.set('roomCount', getCellCount(this.levelData));
    this.registry.set('maxHealth', this.maxHealth);
    this.registry.set('health', this.currentHealth);
    this.registry.set('timerEnabled', this.timerEnabled);
    this.registry.set('coinGoal', this.coinGoal);
    this.registry.set('statueProgress', '0/0');
    this.registry.set('missionStage', 'INIT');
    this.registry.set('missionPrimary', 'Preparing mission...');
    this.registry.set('missionSecondary', '');
    this.registry.set('dangerActive', false);
    this.registry.set('shotsFired', 0);
    this.registry.set('shotsHit', 0);
    this.registry.set('bossRemaining', 0);
    this.syncTimerRegistry(true);
    this.startBackgroundMusic();

    this.buildWorld();
    this.syncCurrentCellFromPlayer(true);
    this.syncMissionRegistry(true);
    this.showMissionBriefing();
  }

  startBackgroundMusic() {
    const backgroundMusicKey = this.runtimeAssets?.backgroundMusicKey;
    if (!backgroundMusicKey || !this.cache.audio.exists(backgroundMusicKey)) {
      return;
    }

    const playTrack = () => {
      if (!this.backgroundMusic) {
        this.backgroundMusic = this.sound.add(backgroundMusicKey, {
          loop: true,
          volume: 0.38,
        });
      }

      if (!this.backgroundMusic.isPlaying) {
        this.backgroundMusic.play();
      }
    };

    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, playTrack);
      return;
    }

    playTrack();
  }

  stopBackgroundMusic() {
    if (!this.backgroundMusic) {
      return;
    }

    this.backgroundMusic.stop();
    this.backgroundMusic.destroy();
    this.backgroundMusic = null;
  }

  buildWorld() {
    this.worldLayout.cells.forEach((cellRecord) => {
      const colorHex = typeof cellRecord.cell?.backgroundColor === 'string'
        ? cellRecord.cell.backgroundColor.trim()
        : DEFAULT_ROOM_BACKGROUND_COLOR;
      const normalizedHex = /^#[0-9a-fA-F]{6}$/.test(colorHex)
        ? colorHex
        : DEFAULT_ROOM_BACKGROUND_COLOR;
      const colorValue = Number.parseInt(normalizedHex.slice(1), 16);

      this.sceneObjects.push(
        this.add
          .rectangle(
            cellRecord.bounds.centerX,
            cellRecord.bounds.centerY,
            cellRecord.bounds.width,
            cellRecord.bounds.height,
            colorValue,
            1,
          )
          .setDepth(-12),
      );

      const backgroundKey = this.manifest.backgrounds[cellRecord.cell.backgroundKey]?.key;
      if (backgroundKey) {
        this.sceneObjects.push(
          this.add
            .image(cellRecord.bounds.centerX, cellRecord.bounds.centerY, backgroundKey)
            .setDisplaySize(cellRecord.bounds.width, cellRecord.bounds.height)
            .setDepth(-11),
        );
      }
    });

    const backgroundTiles = Array.isArray(this.worldObjectsData.backgroundTiles)
      ? [...this.worldObjectsData.backgroundTiles]
      : [];

    backgroundTiles
      .map((tileConfig, index) => ({
        tileConfig,
        index,
        zIndex: Number.isFinite(Number(tileConfig?.zIndex))
          ? Number(tileConfig.zIndex)
          : index,
      }))
      .sort((left, right) => {
        if (left.zIndex !== right.zIndex) {
          return left.zIndex - right.zIndex;
        }

        return left.index - right.index;
      })
      .forEach(({ tileConfig, index }) => {
      const textureKey = typeof tileConfig?.textureKey === 'string' ? tileConfig.textureKey.trim() : '';
      if (!textureKey || !this.textures.exists(textureKey)) {
        return;
      }

      const size = Phaser.Math.Clamp(Math.round(Number(tileConfig.size) || 96), 16, 1024);
      const x = Number(tileConfig.x);
      const y = Number(tileConfig.y);
      const tileX = Number.isFinite(x) ? x : 640;
      const tileY = Number.isFinite(y) ? y : 360;
      const rotationDeg = ((Math.round(Number(tileConfig.rotationDeg) || 0) % 360) + 360) % 360;
      const flipX = Boolean(tileConfig.flipX);
      const flipY = Boolean(tileConfig.flipY);
      const blendMode = String(tileConfig?.blendMode || '').trim().toLowerCase();

      const tileImage = this.add
        .image(tileX, tileY, textureKey)
        .setAngle(rotationDeg)
        .setFlip(flipX, flipY)
        .setDepth(-8 + (index * 0.0001));

      const sourceWidth = Number(tileImage.width) || 0;
      if (sourceWidth > 0) {
        const uniformScale = size / sourceWidth;
        tileImage.setScale(uniformScale, uniformScale);
      } else {
        tileImage.setDisplaySize(size, size);
      }

      if (blendMode === 'screen') {
        tileImage.setBlendMode(Phaser.BlendModes.SCREEN);
      }

      this.sceneObjects.push(tileImage);
    });

    (this.worldObjectsData.platforms || []).forEach((config) => this.createSolidSurface(config));
    (this.worldObjectsData.unlockPlatforms || []).forEach((config) => this.registerQuestionTarget(this.questionUnlockPlatforms, config.lockedByQuestionId, this.createSolidSurface(config, { startsHidden: Boolean(config.startsHidden) })));
    (this.worldObjectsData.barriers || []).forEach((config) => this.registerQuestionTarget(this.questionBarriers, config.lockedByQuestionId, this.createSolidSurface(config)));

    (this.worldObjectsData.coins || []).filter((coinConfig) => !this.collectedCoinIds.has(coinConfig.id)).forEach((coinConfig) => {
      const coin = new Coin(this, coinConfig.x, coinConfig.y, this.manifest.coin);
      coin.coinId = coinConfig.id;
      this.physics.add.overlap(this.player, coin, this.handleCoinPickup, null, this);
      this.sceneObjects.push(coin);
    });

    (this.worldObjectsData.ghosts || []).forEach((ghostConfig) => {
      const ghost = new GhostMinion(this, ghostConfig.x, ghostConfig.y, this.manifest.ghost, ghostConfig);
      this.physics.add.overlap(this.player, ghost, () => this.applyDamage(1, 'ghost', { respawn: true }), null, this);
      this.ghosts.push(ghost);
      this.sceneObjects.push(ghost);
    });

    (this.worldObjectsData.projectileEnemies || []).forEach((projectileConfig) => {
      const enemyType = this.normalizeEnemyType(projectileConfig.enemyType);
      const enemyManifest = this.resolveProjectileEnemyManifest(enemyType);
      const projectileManifest = this.resolveProjectileManifest(enemyType);
      const projectileAnimationKey = enemyType === 'boss'
        ? 'game-one-boss-projectile-float'
        : 'game-one-projectile-float';
      const caster = new ProjectileCaster(this, projectileConfig.x, projectileConfig.y, enemyManifest, {
        ...projectileConfig,
        enemyType,
        projectileManifest,
        projectileAnimationKey,
      });
      this.projectileCasters.push(caster);
      if (enemyType === 'boss') {
        this.bossEntities.push(caster);
      }
      this.sceneObjects.push(caster);
    });

    this.getVillainConfigs().forEach((villainConfig) => {
      const villain = new VillainTrigger(this, villainConfig.x, villainConfig.y, this.manifest.villain, villainConfig);
      villain.setQuestionState(this.completedQuestions.has(villainConfig.questionId) ? 'ANSWERED' : 'UNANSWERED', { animate: false });
      this.physics.add.overlap(this.player, villain, () => this.handleVillainTouch(villain), null, this);
      this.villains.push(villain);
      this.sceneObjects.push(villain);
    });

    this.getPortalConfigs().forEach((portalConfig, index) => {
      const portal = new Portal(this, portalConfig.x, portalConfig.y, this.manifest.portal, portalConfig);
      portal.portalIndex = index;
      portal.touchCooldownUntil = 0;
      portal.lockedByConfig = Boolean(portalConfig.locked) && !portalConfig.questionId;
      this.physics.add.overlap(this.player, portal, () => this.handlePortalTouch(portal), null, this);
      this.registerQuestionTarget(this.questionPortals, portalConfig.questionId, portal);
      this.registerPortalLink(portal);
      this.portals.push(portal);
      this.sceneObjects.push(portal);
    });

    this.syncEndingPortalLocks();
  }

  getVillainConfigs() {
    const rawVillain = this.worldObjectsData?.villain;

    if (Array.isArray(rawVillain)) {
      return rawVillain.filter((entry) => entry && typeof entry === 'object');
    }

    return rawVillain && typeof rawVillain === 'object' ? [rawVillain] : [];
  }

  collectRequiredStatueQuestionIds() {
    return this.getVillainConfigs().reduce((accumulator, villainConfig) => {
      const appearance = typeof villainConfig?.appearance === 'string'
        ? villainConfig.appearance.trim().toUpperCase()
        : '';
      const questionId = typeof villainConfig?.questionId === 'string'
        ? villainConfig.questionId.trim()
        : '';

      if (appearance === 'STATUE' && questionId) {
        accumulator.add(questionId);
      }

      return accumulator;
    }, new Set());
  }

  getStatueQuestionProgress() {
    const total = this.requiredStatueQuestionIds.size;
    if (!total) {
      return { total: 0, answered: 0 };
    }

    let answered = 0;
    this.requiredStatueQuestionIds.forEach((questionId) => {
      if (this.completedQuestions.has(questionId)) {
        answered += 1;
      }
    });

    return { total, answered };
  }

  areAllRequiredStatuesAnswered() {
    const { total, answered } = this.getStatueQuestionProgress();
    return total === 0 || answered >= total;
  }

  normalizeEnemyType(value) {
    if (typeof value !== 'string') {
      return 'elemental';
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'ghost') {
      return 'ghost';
    }

    if (normalized === 'hunter') {
      return 'hunter';
    }

    if (normalized === 'boss') {
      return 'boss';
    }

    if (normalized === 'caster') {
      return 'elemental';
    }

    return 'elemental';
  }

  resolveProjectileEnemyManifest(enemyType) {
    if (enemyType === 'hunter') {
      return this.manifest.hunterEnemy || this.manifest.projectileCaster;
    }

    if (enemyType === 'boss') {
      return this.manifest.bossEnemy || this.manifest.projectileCaster;
    }

    return this.manifest.projectileCaster;
  }

  resolveProjectileManifest(enemyType) {
    if (enemyType === 'boss') {
      return this.manifest.bossProjectile || this.manifest.enemyProjectile;
    }

    return this.manifest.enemyProjectile;
  }

  getEnemyLabel(enemyType) {
    if (enemyType === 'ghost') {
      return 'Ghost';
    }

    if (enemyType === 'hunter') {
      return 'Hunter Drone';
    }

    if (enemyType === 'boss') {
      return 'Boss Sentinel';
    }

    return 'Caster';
  }

  getBossRemaining() {
    return this.projectileCasters.reduce((count, caster) => (
      caster?.active && caster.enemyType === 'boss' ? count + 1 : count
    ), 0);
  }

  resolveCoinGoal() {
    const configuredGoal = Number(this.levelData?.settings?.coinGoal);
    if (Number.isFinite(configuredGoal)) {
      return Phaser.Math.Clamp(Math.round(configuredGoal), 0, this.totalCoins);
    }

    if (this.totalCoins <= 0) {
      return 0;
    }

    if (this.totalCoins <= 3) {
      return this.totalCoins;
    }

    return Phaser.Math.Clamp(Math.ceil(this.totalCoins * 0.6), 1, this.totalCoins);
  }

  setObjectiveMessage(message, holdMs = 2000) {
    this.registry.set('objective', message);
    this.objectiveLockUntil = this.time.now + holdMs;
  }

  getMissionSnapshot() {
    const statues = this.getStatueQuestionProgress();
    const coinsGoalMet = this.coinGoal <= 0 || this.coinsCollected >= this.coinGoal;
    const statuesGoalMet = statues.total === 0 || statues.answered >= statues.total;
    const dangerActive = this.time.now < this.dangerSurgeUntil;
    const bossesRemaining = this.getBossRemaining();

    if (!coinsGoalMet) {
      return {
        stage: 'COLLECT',
        primary: `Collect relic shards (${this.coinsCollected}/${this.coinGoal}).`,
        secondary: dangerActive
          ? 'Enemies are enraged. Stay mobile while collecting.'
          : 'Search each room for coins before challenging all statues.',
      };
    }

    if (!statuesGoalMet) {
      return {
        stage: 'STATUES',
        primary: `Answer statue riddles (${statues.answered}/${statues.total}).`,
        secondary: dangerActive
          ? 'Danger surge active. Wrong answers increase pressure.'
          : 'Find statues, answer correctly, and unlock the exit path.',
      };
    }

    if (this.requireBossDefeat && bossesRemaining > 0) {
      return {
        stage: 'BOSS',
        primary: `Defeat the sentinel boss (${bossesRemaining} remaining).`,
        secondary: dangerActive
          ? 'Danger surge active. Focus shots and avoid burst fire.'
          : 'Use attack timing and cover to break the boss guard.',
      };
    }

    return {
      stage: 'ESCAPE',
      primary: 'Objective complete. Reach the ending portal.',
      secondary: dangerActive
        ? 'Danger surge active. Push to the portal while enemies are fast.'
        : 'Use linked portals and route knowledge to finish the level.',
    };
  }

  syncMissionRegistry(forceObjective = false) {
    const mission = this.getMissionSnapshot();
    const statues = this.getStatueQuestionProgress();
    const localObjective = this.getCurrentObjective();

    this.registry.set('coinGoal', this.coinGoal);
    this.registry.set('statueProgress', `${statues.answered}/${statues.total}`);
    this.registry.set('missionStage', mission.stage);
    this.registry.set('missionPrimary', mission.primary);
    this.registry.set('missionSecondary', mission.secondary);
    this.registry.set('dangerActive', this.time.now < this.dangerSurgeUntil);
    this.registry.set('shotsFired', this.playerShotsFired);
    this.registry.set('shotsHit', this.playerShotsHit);
    this.registry.set('bossRemaining', this.getBossRemaining());

    if (forceObjective || this.time.now >= this.objectiveLockUntil) {
      this.registry.set('objective', `${mission.primary} ${localObjective}`.trim());
    }
  }

  showMissionBriefing() {
    const mission = this.getMissionSnapshot();
    const bossLine = this.requireBossDefeat
      ? '\nDefeat the sentinel before using the ending portal.'
      : '';
    const briefing = this.add.text(
      this.cameras.main.width / 2,
      72,
      `Mission Online\n${mission.primary}\nPress J to fire arc bolts.${bossLine}`,
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        align: 'center',
        color: '#f8fafc',
      },
    );

    briefing
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1400)
      .setPadding(18, 12, 18, 12)
      .setBackgroundColor('#0f172acc');

    this.tweens.add({
      targets: briefing,
      alpha: 0,
      delay: 3200,
      duration: 700,
      ease: 'Sine.InOut',
      onComplete: () => briefing.destroy(),
    });
  }

  triggerDangerSurge(durationMs = DANGER_SURGE_DURATION_MS) {
    this.dangerSurgeUntil = Math.max(this.dangerSurgeUntil, this.time.now + durationMs);
    this.updateDangerState(this.time.now);
    this.setObjectiveMessage('Wrong answer! Enemies are enraged for a short time.', 2600);
  }

  updateDangerState(now) {
    const shouldBeActive = now < this.dangerSurgeUntil;
    if (shouldBeActive === this.dangerStateActive) {
      return;
    }

    this.dangerStateActive = shouldBeActive;

    this.ghosts.forEach((ghost) => {
      if (!ghost || !ghost.active) {
        return;
      }

      if (typeof ghost.baseSpeed !== 'number') {
        ghost.baseSpeed = ghost.speed;
      }

      ghost.speed = shouldBeActive
        ? Math.round(ghost.baseSpeed * 1.35)
        : ghost.baseSpeed;
      ghost.setTint(shouldBeActive ? 0xf97316 : 0xffffff);
    });

    this.projectileCasters.forEach((caster) => {
      if (!caster || !caster.active) {
        return;
      }

      if (typeof caster.baseFireIntervalMs !== 'number') {
        caster.baseFireIntervalMs = caster.fireIntervalMs;
      }
      if (typeof caster.baseWarningLeadMs !== 'number') {
        caster.baseWarningLeadMs = caster.warningLeadMs;
      }

      caster.fireIntervalMs = shouldBeActive
        ? Math.max(450, Math.round(caster.baseFireIntervalMs * 0.75))
        : caster.baseFireIntervalMs;
      caster.warningLeadMs = shouldBeActive
        ? Math.max(130, Math.round(caster.baseWarningLeadMs * 0.7))
        : caster.baseWarningLeadMs;
    });

    this.syncMissionRegistry(true);
  }

  firePlayerProjectile() {
    if (this.time.now < this.playerProjectileCooldownUntil) {
      return;
    }

    const direction = this.player?.facing === -1 ? -1 : 1;
    const spawnX = this.player.x + (direction * 44);
    const spawnY = this.player.y - 10;
    const projectile = new EnemyProjectile(this, spawnX, spawnY, this.manifest.enemyProjectile, {
      direction,
      speed: PLAYER_PROJECTILE_SPEED,
      lifetimeMs: PLAYER_PROJECTILE_LIFETIME_MS,
      boundsLeft: this.worldLayout.bounds.left,
      boundsRight: this.worldLayout.bounds.right,
    });

    projectile.setScale(PLAYER_PROJECTILE_SCALE);
    projectile.setTint(0x34d399);
    projectile.playerOwned = true;

    this.ghosts.forEach((ghost) => {
      this.physics.add.overlap(projectile, ghost, () => this.handlePlayerProjectileHit(projectile, ghost, 'ghost'), null, this);
    });

    this.projectileCasters.forEach((caster) => {
      this.physics.add.overlap(projectile, caster, () => this.handlePlayerProjectileHit(projectile, caster, caster.enemyType || 'elemental'), null, this);
    });

    this.staticBodies.forEach((body) => {
      this.physics.add.collider(projectile, body, () => projectile.destroyProjectile());
    });

    this.playerProjectiles.push(projectile);
    this.sceneObjects.push(projectile);
    this.playerShotsFired += 1;
    this.playerProjectileCooldownUntil = this.time.now + PLAYER_PROJECTILE_COOLDOWN_MS;
    this.syncMissionRegistry();
  }

  handlePlayerProjectileHit(projectile, enemy, enemyType) {
    if (!projectile?.active || !enemy?.active) {
      return;
    }

    projectile.destroyProjectile();
    const resolvedEnemyType = this.normalizeEnemyType(enemyType || enemy.enemyType);
    const defeated = typeof enemy.applyProjectileHit === 'function'
      ? enemy.applyProjectileHit(1)
      : (() => {
        enemy.destroy();
        return true;
      })();
    this.playerShotsHit += 1;

    if (!defeated) {
      const healthLabel = Number.isFinite(enemy.hitPoints)
        ? ` (${enemy.hitPoints}/${enemy.maxHitPoints})`
        : '';
      this.setObjectiveMessage(`${this.getEnemyLabel(resolvedEnemyType)} hit${healthLabel}. Keep firing.`, 900);
      this.syncMissionRegistry();
      return;
    }

    if (resolvedEnemyType === 'ghost') {
      this.ghosts = this.ghosts.filter((ghost) => ghost !== enemy && ghost.active);
    }

    if (resolvedEnemyType !== 'ghost') {
      this.projectileCasters = this.projectileCasters.filter((caster) => caster !== enemy && caster.active);
      if (resolvedEnemyType === 'boss') {
        this.bossEntities = this.bossEntities.filter((boss) => boss !== enemy && boss.active);
      }
    }

    this.syncEndingPortalLocks();
    this.setObjectiveMessage(`Great shot! ${this.getEnemyLabel(resolvedEnemyType)} destroyed.`, 1300);
    this.syncMissionRegistry();
  }

  clearGuidedStatue() {
    if (!this.guidedStatue || !this.guidedStatue.active) {
      this.guidedStatue = null;
      return;
    }

    if (this.guidedStatue.questionState !== 'ANSWERED') {
      if (this.guidedStatue.appearance === 'STATUE') {
        this.guidedStatue.setTint(0xcbd5e1);
      } else {
        this.guidedStatue.setTint(0xfbbf24);
      }
    }

    this.guidedStatue = null;
  }

  updateStatueGuidance(now) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.villains.forEach((villain) => {
      if (!villain?.active || !villain.questionId || villain.questionState === 'ANSWERED') {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, villain.x, villain.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = villain;
      }
    });

    if (!nearest || nearestDistance > 210) {
      this.clearGuidedStatue();
      return;
    }

    if (this.guidedStatue !== nearest) {
      this.clearGuidedStatue();
      this.guidedStatue = nearest;
    }

    if (nearest.questionState !== 'ANSWERED') {
      nearest.setTint(nearest.appearance === 'STATUE' ? 0xfde68a : 0xf97316);
    }

    if (now - this.lastStatueHintAt >= 2400) {
      this.lastStatueHintAt = now;
      this.setObjectiveMessage(`You are near a ${this.getQuestionTriggerLabel()}. Touch it to answer and progress.`, 1400);
    }
  }

  syncEndingPortalLocks() {
    if (!this.portals.length) {
      return;
    }

    const requiresStatueUnlock = this.requiredStatueQuestionIds.size > 0;
    const allStatuesAnswered = this.areAllRequiredStatuesAnswered();
    const lockedByBoss = this.requireBossDefeat && this.getBossRemaining() > 0;

    this.portals.forEach((portal) => {
      if (!portal || portal.endsLevel === false) {
        return;
      }

      const lockedByQuestion = Boolean(portal.questionId) && !this.completedQuestions.has(portal.questionId);
      const lockedByStatues = requiresStatueUnlock && !allStatuesAnswered;
      const lockedByConfig = Boolean(portal.lockedByConfig);
      portal.setLocked(lockedByConfig || lockedByQuestion || lockedByStatues || lockedByBoss);
    });
  }

  getPortalConfigs() {
    const rawPortal = this.worldObjectsData?.portal;
    if (Array.isArray(rawPortal)) {
      return rawPortal.filter((entry) => entry && typeof entry === 'object');
    }

    return rawPortal && typeof rawPortal === 'object' ? [rawPortal] : [];
  }

  registerPortalLink(portal) {
    const linkName = typeof portal?.linkName === 'string' ? portal.linkName.trim() : '';
    if (!linkName) {
      return;
    }

    if (!this.portalsByLinkName.has(linkName)) {
      this.portalsByLinkName.set(linkName, []);
    }

    this.portalsByLinkName.get(linkName).push(portal);
  }

  registerQuestionTarget(targetMap, questionId, target) {
    if (!questionId) return;
    if (!targetMap.has(questionId)) targetMap.set(questionId, []);
    targetMap.get(questionId).push(target);
  }

  createSolidSurface(config, { startsHidden = false } = {}) {
    const { textureMeta, visualHeight, bodyHeight, bodyWidth, collisionMode, bodyOffsetY } = getGameOneSurfaceMetrics(this.manifest, config);
    const isInvisible = Boolean(config.invisible);
    const passThroughSides = normalizePassThroughSides(config.passThroughSides);
    const visual = isInvisible
      ? this.add.rectangle(config.x, config.y, config.width, visualHeight, 0xffffff, 0).setOrigin(0.5)
      : this.add.tileSprite(config.x, config.y, config.width, visualHeight, textureMeta.key).setOrigin(0.5);
    const body = this.add.rectangle(config.x, config.y + bodyOffsetY, bodyWidth, bodyHeight, 0xffffff, 0);
    this.physics.add.existing(body, true);
    const collider = this.physics.add.collider(this.player, body, null, (playerObject, platformObject) => {
      const playerBody = playerObject.body;
      const platformBody = platformObject.body;

      if (passThroughSides.length > 0) {
        return !shouldSkipCollisionForPassThrough(playerBody, platformBody, passThroughSides);
      }

      if (collisionMode === 'ONE_WAY') {
        const previousBottom = (playerBody.prev?.y ?? playerBody.y) + playerBody.height;
        return playerBody.velocity.y >= 0 && previousBottom <= platformBody.top + 12;
      }

      return true;
    }, this);
    const entry = {
      config,
      visual,
      body,
      collider,
      unlocked: false,
      originalY: config.y,
      isInvisible,
    };
    if (isInvisible) {
      visual.setVisible(false);
      visual.setAlpha(0);
    }
    if (startsHidden) {
      visual.setVisible(false);
      visual.setAlpha(0);
      visual.setY(config.y + 18);
      body.body.enable = false;
      collider.active = false;
    }
    this.staticBodies.push(body);
    this.sceneObjects.push(visual, body);
    return entry;
  }

  revealUnlockPlatform(entry) {
    if (!entry || entry.unlocked) return false;
    entry.unlocked = true;
    entry.body.body.enable = true;
    entry.collider.active = true;

    if (!entry.isInvisible) {
      entry.visual.setVisible(true);
      this.tweens.add({ targets: entry.visual, y: entry.originalY, alpha: 1, duration: 220, ease: 'Back.Out' });
    }

    return true;
  }

  dropBarrier(entry) {
    if (!entry || entry.unlocked) return false;
    entry.unlocked = true;
    entry.body.body.enable = false;
    entry.collider.active = false;
    this.tweens.add({ targets: entry.visual, y: entry.visual.y + 26, alpha: 0, duration: 220, ease: 'Quad.In' });
    return true;
  }

  unlockQuestionTargets(questionId) {
    (this.questionUnlockPlatforms.get(questionId) || []).forEach((entry) => this.revealUnlockPlatform(entry));
    (this.questionBarriers.get(questionId) || []).forEach((entry) => this.dropBarrier(entry));
    (this.questionPortals.get(questionId) || []).forEach((portal) => { if (!portal.isUnlocked()) portal.setLocked(false); });
  }

  spawnProjectileFromCaster(caster, time) {
    const spawnPoint = caster.getShotSpawnPoint();
    const projectileManifest = caster.projectileManifest || this.manifest.enemyProjectile;
    const projectile = new EnemyProjectile(this, spawnPoint.x, spawnPoint.y, projectileManifest, {
      direction: caster.fireDirection,
      speed: caster.projectileSpeed,
      lifetimeMs: caster.projectileLifetimeMs,
      boundsLeft: this.worldLayout.bounds.left,
      boundsRight: this.worldLayout.bounds.right,
      animationKey: caster.projectileAnimationKey,
    });
    this.physics.add.overlap(this.player, projectile, () => { projectile.destroyProjectile(); this.applyDamage(1, 'projectile', { respawn: true }); }, null, this);
    this.staticBodies.forEach((body) => this.physics.add.collider(projectile, body, () => projectile.destroyProjectile()));
    this.projectiles.push(projectile);
    caster.consumeShot(time);
  }

  getSpawnPoint() {
    const spawn = this.worldObjectsData.spawn;
    if (spawn) return { x: spawn.x, y: spawn.y };
    const firstCell = this.worldLayout.cells[0];
    return firstCell ? { x: firstCell.bounds.left + 160, y: firstCell.bounds.top + 560 } : { x: 120, y: 560 };
  }

  getQuestionTriggerLabel() {
    const firstVillain = this.getVillainConfigs()[0] || null;
    return firstVillain?.appearance === 'STATUE' ? 'statue' : (firstVillain?.interactionLabel || 'villain');
  }

  getCurrentObjective() {
    const cell = this.currentCellRecord?.cell;
    if (!cell) return 'Explore the map and keep moving.';
    const cellBounds = getCellWorldBounds(cell, this.levelData.viewport);
    const portalsInCell = this.getPortalConfigs().filter((portal) => (
      portal.x >= cellBounds.left
      && portal.x < cellBounds.right
      && portal.y >= cellBounds.top
      && portal.y < cellBounds.bottom
    ));
    const portalInCell = portalsInCell.length > 0;
    const endingPortalInCell = portalsInCell.some((portal) => portal?.endsLevel !== false);
    const primaryQuestionId = this.getVillainConfigs()[0]?.questionId;
    const unlocked = (this.worldObjectsData.unlockPlatforms || []).some((entry) => this.completedQuestions.has(entry.lockedByQuestionId))
      || (this.worldObjectsData.barriers || []).some((entry) => this.completedQuestions.has(entry.lockedByQuestionId))
      || portalsInCell.some((portal) => portal?.questionId && this.completedQuestions.has(portal.questionId));
    if (primaryQuestionId && this.completedQuestions.has(primaryQuestionId) && cell.postUnlockObjective) return cell.postUnlockObjective;
    if (unlocked && cell.postUnlockObjective) return cell.postUnlockObjective;

    if (endingPortalInCell && this.requiredStatueQuestionIds.size > 0 && !this.areAllRequiredStatuesAnswered()) {
      const { answered, total } = this.getStatueQuestionProgress();
      return `Answer every statue correctly to unseal the ending portal (${answered}/${total}).`;
    }

    if (endingPortalInCell && this.requireBossDefeat && this.getBossRemaining() > 0) {
      return `Defeat the sentinel boss before the ending portal can stabilize (${this.getBossRemaining()} remaining).`;
    }

    return cell.objective || (portalInCell ? 'Reach the final portal to finish the level.' : 'Explore the connected map and push into the next area.');
  }

  syncHealthRegistry() {
    this.registry.set('health', Number(this.currentHealth.toFixed(1)));
    this.registry.set('maxHealth', this.maxHealth);
  }

  syncTimerRegistry(force = false) {
    this.registry.set('timerEnabled', this.timerEnabled);

    if (!this.timerEnabled) {
      this.registry.set('timerSecondsRemaining', null);
      return;
    }

    const secondsRemaining = Math.max(0, Math.ceil(this.remainingTimeMs / 1000));
    if (force || this.lastTimerSecond !== secondsRemaining) {
      this.lastTimerSecond = secondsRemaining;
      this.registry.set('timerSecondsRemaining', secondsRemaining);
    }
  }

  resetDamageFeedback() {
    if (this.damageTween) {
      this.damageTween.stop();
      this.damageTween = null;
    }
    this.player.setAlpha(1);
    this.player.clearTint();
  }

  playDamageFeedback() {
    this.resetDamageFeedback();
    this.player.setTintFill(0xf87171);
    this.damageTween = this.tweens.add({
      targets: this.player,
      alpha: 0.34,
      duration: 90,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.damageTween = null;
        this.player.setAlpha(1);
        this.player.clearTint();
      },
    });
  }

  respawnPlayer() {
    const spawnPoint = this.getSpawnPoint();
    this.player.setPosition(spawnPoint.x, spawnPoint.y);
    this.player.setVelocity(0, 0);
    this.syncCurrentCellFromPlayer(true);
    this.cameras.main.shake(120, 0.004);
  }

  getDamageObjective(reason) {
    if (reason === 'question') return `Wrong answer. You lost half a heart. Touch the ${this.getQuestionTriggerLabel()} again to retry.`;
    if (reason === 'ghost') return 'The ghost hit you. One heart lost. You were returned to the area start.';
    if (reason === 'projectile') return 'The projectile hit you. One heart lost. You were returned to the area start.';
    if (reason === 'fall') return 'You fell. One heart lost. You were returned to the area start.';
    return 'You took damage. Keep moving and protect your remaining health.';
  }

  applyDamage(amount, reason, { respawn = false, bypassInvulnerability = false } = {}) {
    if (this.hasFinished) return;
    if (!bypassInvulnerability && this.time.now < this.damageCooldownUntil) return;
    this.currentHealth = Math.max(0, (Math.round((this.currentHealth - amount) * 2) / 2));
    this.syncHealthRegistry();
    if (this.currentHealth <= 0) { this.failLevel(reason); return; }
    this.damageCooldownUntil = this.time.now + (respawn ? 1100 : 400);
    this.playDamageFeedback();
    if (respawn) this.respawnPlayer();
    this.setObjectiveMessage(this.getDamageObjective(reason), 2400);
    this.syncMissionRegistry();
  }

  syncCurrentCellFromPlayer(force = false) {
    const nextRecord = getCellRecordAtWorldPoint(this.worldLayout, this.player.x, this.player.y) || this.currentCellRecord || this.worldLayout.cells[0] || null;
    if (!nextRecord) return;
    if (!force && this.currentCellRecord?.cellId === nextRecord.cellId) return;
    this.currentCellRecord = nextRecord;
    this.registry.set('roomLabel', 'Area');
    this.registry.set('roomIndex', nextRecord.index + 1);
    this.syncMissionRegistry(force);
  }

  handleCoinPickup(player, coin) {
    if (this.collectedCoinIds.has(coin.coinId)) return;
    this.collectedCoinIds.add(coin.coinId);
    this.coinsCollected += 1;
    this.registry.set('coinsCollected', this.coinsCollected);
    if (this.coinGoal > 0) {
      this.setObjectiveMessage(`Relic shard collected (${this.coinsCollected}/${this.coinGoal}).`, 1000);
    }
    this.syncMissionRegistry();
    coin.destroy();
  }

  handleVillainTouch(villain) {
    if (this.hasFinished || this.isPaused || this.isInteractionLocked || !villain?.questionId || this.completedQuestions.has(villain.questionId) || this.time.now < this.questionCooldownUntil) return;
    const question = getQuestionById(this.levelData, villain.questionId);
    if (!question) return;
    this.isInteractionLocked = true;
    this.player.freeze(true);
    this.physics.world.pause();
    this.scene.launch('QuestionScene', { question, questionId: villain.questionId });
  }

  handleQuestionAnswered({ questionId, correct }) {
    this.questionCooldownUntil = this.time.now + 600;
    this.isInteractionLocked = false;
    this.player.freeze(false);
    this.physics.world.resume();
    if (correct) {
      this.completedQuestions.add(questionId);
      this.villains.filter((villain) => villain.questionId === questionId).forEach((villain) => villain.setQuestionState('ANSWERED', { animate: true }));
      this.unlockQuestionTargets(questionId);
      this.syncEndingPortalLocks();
      this.syncCurrentCellFromPlayer(true);
      this.setObjectiveMessage('Riddle solved. New paths are opening.', 1600);
      this.syncMissionRegistry();
      return;
    }
    this.wrongAnswers += 1;
    this.triggerDangerSurge();
    this.applyDamage(0.5, 'question', { bypassInvulnerability: true });
    this.syncMissionRegistry();
  }

  handlePortalTouch(portal) {
    if (this.hasFinished || this.isPaused || this.isInteractionLocked || !portal) return;
    if (this.time.now < Number(portal.touchCooldownUntil || 0)) return;
    portal.touchCooldownUntil = this.time.now + 350;
    if (!portal.isUnlocked()) {
      if (portal.endsLevel !== false && this.requiredStatueQuestionIds.size > 0 && !this.areAllRequiredStatuesAnswered()) {
        const { answered, total } = this.getStatueQuestionProgress();
        this.setObjectiveMessage(`The ending portal is sealed. Complete all statue questions first (${answered}/${total}).`, 2200);
      } else if (portal.endsLevel !== false && this.requireBossDefeat && this.getBossRemaining() > 0) {
        this.setObjectiveMessage(`The ending portal is unstable. Defeat the sentinel boss first (${this.getBossRemaining()} remaining).`, 2200);
      } else {
        this.setObjectiveMessage(`The portal is sealed. Touch the ${this.getQuestionTriggerLabel()} and answer correctly first.`, 2200);
      }
      return;
    }

    const pair = this.resolvePortalPair(portal);
    if (pair?.destination) {
      this.teleportPlayerToPortal(portal, pair.destination, pair.linkName);
      return;
    }

    if (pair && pair.linkName) {
      if (pair.portals.length < 2) {
        this.setObjectiveMessage(`Portal "${pair.linkName}" needs one more matching portal.`, 2200);
      } else {
        this.setObjectiveMessage(`Portal name "${pair.linkName}" is used by more than two portals.`, 2200);
      }
      return;
    }

    if (portal.endsLevel !== false) {
      this.finishLevel();
      return;
    }

    this.setObjectiveMessage('Name this portal and place exactly one matching portal to enable teleporting.', 2200);
  }

  resolvePortalPair(portal) {
    const linkName = typeof portal?.linkName === 'string' ? portal.linkName.trim() : '';
    if (!linkName) {
      return null;
    }

    const linkedPortals = (this.portalsByLinkName.get(linkName) || []).filter((entry) => entry?.active);
    if (linkedPortals.length !== 2) {
      return {
        linkName,
        portals: linkedPortals,
        destination: null,
      };
    }

    return {
      linkName,
      portals: linkedPortals,
      destination: linkedPortals[0] === portal ? linkedPortals[1] : linkedPortals[0],
    };
  }

  teleportPlayerToPortal(fromPortal, toPortal, linkName) {
    const cooldownUntil = this.time.now + 850;
    fromPortal.touchCooldownUntil = cooldownUntil;
    toPortal.touchCooldownUntil = cooldownUntil;
    const horizontalOffset = fromPortal.x <= toPortal.x ? 56 : -56;
    const destinationX = Phaser.Math.Clamp(
      toPortal.x + horizontalOffset,
      this.worldLayout.bounds.left + 24,
      this.worldLayout.bounds.right - 24,
    );
    this.player.setPosition(destinationX, toPortal.y - 8);
    this.player.setVelocity(0, 0);
    this.syncCurrentCellFromPlayer(true);
    this.setObjectiveMessage(`Teleported through portal "${linkName}".`, 1300);
  }

  togglePause(nextState = !this.isPaused) {
    if (this.hasFinished || this.isInteractionLocked) return;
    this.isPaused = nextState;
    this.player.freeze(nextState);
    nextState ? this.physics.world.pause() : this.physics.world.resume();
    this.callbacks.onPauseChange?.(nextState);
  }

  resumeFromOverlay() { this.togglePause(false); }
  requestExitFromOverlay() { this.callbacks.onExitRequest?.(); }

  failLevel(reason) {
    if (this.hasFinished) return;
    this.hasFinished = true;
    this.resetDamageFeedback();
    this.player.freeze(true);
    this.physics.world.pause();
    this.callbacks.onPauseChange?.(false);
    const statues = this.getStatueQuestionProgress();
    this.callbacks.onLevelFail?.({
      outcome: 'FAILED',
      reason,
      coinsCollected: this.coinsCollected,
      totalCoins: this.totalCoins,
      coinGoal: this.coinGoal,
      wrongAnswers: this.wrongAnswers,
      statuesAnswered: statues.answered,
      totalStatues: statues.total,
      shotsFired: this.playerShotsFired,
      shotsHit: this.playerShotsHit,
      elapsedMs: Date.now() - this.levelStartedAt,
      missionStage: this.getMissionSnapshot().stage,
    });
  }

  finishLevel() {
    if (this.hasFinished) return;
    this.hasFinished = true;
    this.resetDamageFeedback();
    this.player.freeze(true);
    this.physics.world.pause();
    this.callbacks.onPauseChange?.(false);
    const statues = this.getStatueQuestionProgress();
    this.callbacks.onLevelComplete?.({
      outcome: 'COMPLETED',
      coinsCollected: this.coinsCollected,
      totalCoins: this.totalCoins,
      coinGoal: this.coinGoal,
      wrongAnswers: this.wrongAnswers,
      statuesAnswered: statues.answered,
      totalStatues: statues.total,
      shotsFired: this.playerShotsFired,
      shotsHit: this.playerShotsHit,
      elapsedMs: Date.now() - this.levelStartedAt,
      missionStage: this.getMissionSnapshot().stage,
    });
  }

  update() {
    if (this.hasFinished) return;
    if (wasPausePressed(this.controls)) { this.togglePause(); return; }
    if (this.isPaused || this.isInteractionLocked) return;

    if (this.timerEnabled) {
      this.remainingTimeMs = Math.max(0, this.remainingTimeMs - Number(this.game.loop?.delta || 0));
      this.syncTimerRegistry();
      if (this.remainingTimeMs <= 0) {
        this.failLevel('timeout');
        return;
      }
    }

    const intent = readMovementIntent(this.controls);
    const now = this.time.now;
    this.updateDangerState(now);

    if (intent.attackPressed) {
      this.firePlayerProjectile();
    }

    this.player.update(intent);
    this.ghosts.forEach((ghost) => ghost.update());
    this.projectileCasters.forEach((caster) => { caster.update(now); if (caster.shouldFire(now)) this.spawnProjectileFromCaster(caster, now); });
    this.projectiles = this.projectiles.filter((projectile) => {
      if (!projectile.active) return false;
      projectile.update(now);
      return projectile.active;
    });
    this.playerProjectiles = this.playerProjectiles.filter((projectile) => {
      if (!projectile.active) return false;
      projectile.update(now);
      return projectile.active;
    });
    this.updateStatueGuidance(now);
    this.syncCurrentCellFromPlayer();
    if (this.player.y > this.worldLayout.bounds.bottom + 80) this.applyDamage(1, 'fall', { respawn: true, bypassInvulnerability: true });
  }
}
