import Phaser from 'phaser';

export default class HudScene extends Phaser.Scene {
  constructor() {
    super('HudScene');
  }

  create() {
    this.topPanel = this.add.rectangle(28, 24, 500, 244, 0x0f172a, 0.76).setOrigin(0, 0);
    this.topPanel.setStrokeStyle(3, 0xf8fafc, 0.9);

    this.roomText = this.add.text(48, 40, 'Room 1/3', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f8fafc'
    });

    this.healthText = this.add.text(48, 72, 'Health 3/3', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#fca5a5'
    });

    this.coinText = this.add.text(48, 98, 'Coins 0/0', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#fde68a'
    });

    this.timerText = this.add.text(48, 124, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#93c5fd'
    });

    this.objectiveText = this.add.text(48, 148, 'Area Objective', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cbd5e1',
      wordWrap: { width: 452 }
    });

    this.missionPrimaryText = this.add.text(48, 182, 'Mission', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#86efac',
      wordWrap: { width: 452 }
    });

    this.missionSecondaryText = this.add.text(48, 212, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#93c5fd',
      wordWrap: { width: 452 }
    });

    this.footerText = this.add.text(1248, 686, 'Move: WASD / Arrows  Jump: W / Up / Space  Air Dash: Space  Attack: J  Pause: ESC', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#e2e8f0'
    }).setOrigin(1, 1);

    this.syncFromRegistry();

    this.registry.events.on('changedata-roomLabel', this.syncFromRegistry, this);
    this.registry.events.on('changedata-roomIndex', this.syncFromRegistry, this);
    this.registry.events.on('changedata-roomCount', this.syncFromRegistry, this);
    this.registry.events.on('changedata-health', this.syncFromRegistry, this);
    this.registry.events.on('changedata-maxHealth', this.syncFromRegistry, this);
    this.registry.events.on('changedata-coinsCollected', this.syncFromRegistry, this);
    this.registry.events.on('changedata-totalCoins', this.syncFromRegistry, this);
    this.registry.events.on('changedata-timerEnabled', this.syncFromRegistry, this);
    this.registry.events.on('changedata-timerSecondsRemaining', this.syncFromRegistry, this);
    this.registry.events.on('changedata-objective', this.syncFromRegistry, this);
    this.registry.events.on('changedata-coinGoal', this.syncFromRegistry, this);
    this.registry.events.on('changedata-statueProgress', this.syncFromRegistry, this);
    this.registry.events.on('changedata-missionStage', this.syncFromRegistry, this);
    this.registry.events.on('changedata-missionPrimary', this.syncFromRegistry, this);
    this.registry.events.on('changedata-missionSecondary', this.syncFromRegistry, this);
    this.registry.events.on('changedata-dangerActive', this.syncFromRegistry, this);
    this.registry.events.on('changedata-shotsFired', this.syncFromRegistry, this);
    this.registry.events.on('changedata-shotsHit', this.syncFromRegistry, this);
    this.registry.events.on('changedata-bossRemaining', this.syncFromRegistry, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-roomLabel', this.syncFromRegistry, this);
      this.registry.events.off('changedata-roomIndex', this.syncFromRegistry, this);
      this.registry.events.off('changedata-roomCount', this.syncFromRegistry, this);
      this.registry.events.off('changedata-health', this.syncFromRegistry, this);
      this.registry.events.off('changedata-maxHealth', this.syncFromRegistry, this);
      this.registry.events.off('changedata-coinsCollected', this.syncFromRegistry, this);
      this.registry.events.off('changedata-totalCoins', this.syncFromRegistry, this);
      this.registry.events.off('changedata-timerEnabled', this.syncFromRegistry, this);
      this.registry.events.off('changedata-timerSecondsRemaining', this.syncFromRegistry, this);
      this.registry.events.off('changedata-objective', this.syncFromRegistry, this);
      this.registry.events.off('changedata-coinGoal', this.syncFromRegistry, this);
      this.registry.events.off('changedata-statueProgress', this.syncFromRegistry, this);
      this.registry.events.off('changedata-missionStage', this.syncFromRegistry, this);
      this.registry.events.off('changedata-missionPrimary', this.syncFromRegistry, this);
      this.registry.events.off('changedata-missionSecondary', this.syncFromRegistry, this);
      this.registry.events.off('changedata-dangerActive', this.syncFromRegistry, this);
      this.registry.events.off('changedata-shotsFired', this.syncFromRegistry, this);
      this.registry.events.off('changedata-shotsHit', this.syncFromRegistry, this);
      this.registry.events.off('changedata-bossRemaining', this.syncFromRegistry, this);
    });
  }

  syncFromRegistry() {
    const roomLabel = this.registry.get('roomLabel') || 'Room';
    const roomIndex = Number(this.registry.get('roomIndex') || 0);
    const roomCount = Number(this.registry.get('roomCount') || 0);
    const health = Number(this.registry.get('health') || 0);
    const maxHealth = Number(this.registry.get('maxHealth') || 3);
    const coinsCollected = Number(this.registry.get('coinsCollected') || 0);
    const totalCoins = Number(this.registry.get('totalCoins') || 0);
    const coinGoal = Number(this.registry.get('coinGoal') || 0);
    const timerEnabled = Boolean(this.registry.get('timerEnabled'));
    const timerSecondsRemaining = Number(this.registry.get('timerSecondsRemaining'));
    const objective = this.registry.get('objective') || 'Explore the room.';
    const statueProgress = this.registry.get('statueProgress') || '0/0';
    const missionPrimary = this.registry.get('missionPrimary') || 'Complete the mission objectives.';
    const missionSecondary = this.registry.get('missionSecondary') || '';
    const dangerActive = Boolean(this.registry.get('dangerActive'));
    const shotsFired = Number(this.registry.get('shotsFired') || 0);
    const shotsHit = Number(this.registry.get('shotsHit') || 0);
    const bossRemaining = Number(this.registry.get('bossRemaining') || 0);
    const healthLabel = Number.isInteger(health) ? health.toFixed(0) : health.toFixed(1);
    const minutes = Number.isFinite(timerSecondsRemaining) ? Math.floor(timerSecondsRemaining / 60) : 0;
    const seconds = Number.isFinite(timerSecondsRemaining) ? timerSecondsRemaining % 60 : 0;
    const healthRatio = maxHealth > 0 ? health / maxHealth : 0;
    const timerLow = timerEnabled && Number.isFinite(timerSecondsRemaining) && timerSecondsRemaining <= 30;
    const timerWarn = timerEnabled && Number.isFinite(timerSecondsRemaining) && timerSecondsRemaining > 30 && timerSecondsRemaining <= 60;

    if (healthRatio <= 0.34) {
      this.healthText.setColor('#fca5a5');
    } else if (healthRatio <= 0.67) {
      this.healthText.setColor('#fde68a');
    } else {
      this.healthText.setColor('#86efac');
    }

    if (timerLow) {
      this.timerText.setColor('#fca5a5');
    } else if (timerWarn) {
      this.timerText.setColor('#fde68a');
    } else {
      this.timerText.setColor('#93c5fd');
    }

    this.missionPrimaryText.setColor(dangerActive ? '#fca5a5' : '#86efac');
    this.missionSecondaryText.setColor(dangerActive ? '#fdba74' : '#93c5fd');

    this.roomText.setText(`${roomLabel} ${roomIndex}/${roomCount}  |  Statues ${statueProgress}`);
    this.healthText.setText(`Health ${healthLabel}/${maxHealth}`);
    this.coinText.setText(coinGoal > 0
      ? `Coins ${coinsCollected}/${totalCoins}  (Goal ${coinGoal})`
      : `Coins ${coinsCollected}/${totalCoins}`);
    this.timerText.setVisible(timerEnabled);
    this.timerText.setText(timerEnabled ? `Timer ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : '');
    this.objectiveText.setText(`Area: ${objective}`);
    this.missionPrimaryText.setText(`Mission: ${missionPrimary}`);
    this.missionSecondaryText.setText(
      `Status: ${missionSecondary}  |  Shots ${shotsHit}/${shotsFired}${bossRemaining > 0 ? `  |  Boss ${bossRemaining}` : ''}`
    );
  }
}
