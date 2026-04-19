import Phaser from 'phaser';

const BUTTON_TONES = {
  primary: {
    fill: 0x166534,
    stroke: 0x052e16,
    hoverFill: 0x15803d,
    text: '#f0fdf4',
  },
  secondary: {
    fill: 0xd97706,
    stroke: 0x7c2d12,
    hoverFill: 0xf59e0b,
    text: '#fff7ed',
  },
  muted: {
    fill: 0x475569,
    stroke: 0x1e293b,
    hoverFill: 0x64748b,
    text: '#f8fafc',
  },
};

const STAT_TONES = {
  amber: {
    fill: 0xfff4d6,
    stroke: 0xd97706,
    label: '#9a3412',
    value: '#7c2d12',
  },
  emerald: {
    fill: 0xe8f8ee,
    stroke: 0x15803d,
    label: '#166534',
    value: '#14532d',
  },
  slate: {
    fill: 0xe2e8f0,
    stroke: 0x475569,
    label: '#334155',
    value: '#0f172a',
  },
};

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.mode = null;
    this.overlay = null;
    this.panel = null;
  }

  create() {
    this.overlay = this.add.rectangle(640, 360, 1280, 720, 0x020617, 0.82)
      .setDepth(500)
      .setVisible(false);
    this.overlay.disableInteractive();
  }

  hideMenu(mode = null) {
    if (mode && this.mode !== mode) {
      return;
    }

    this.mode = null;
    this.panel?.destroy();
    this.panel = null;

    if (this.overlay) {
      this.overlay.setVisible(false);
      this.overlay.disableInteractive();
    }
  }

  showPauseMenu({ onResume, onExit }) {
    this.showPanel({
      mode: 'pause',
      kicker: 'Session Pause',
      title: 'Paused',
      body: 'Take a breather, then jump back into the tutorial when you are ready.',
      stats: [],
      buttons: [
        {
          label: 'Resume',
          tone: 'primary',
          onClick: () => {
            this.hideMenu('pause');
            onResume?.();
          }
        },
        {
          label: 'Exit Level',
          tone: 'muted',
          onClick: () => {
            this.hideMenu('pause');
            onExit?.();
          }
        }
      ]
    });
  }

  showResultMenu({
    result,
    gameplay,
    isSubmitting,
    canAdvanceLevel,
    onRetry,
    onBack,
    onNextLevel,
  }) {
    const isFailure = result?.result === 'FAILED';
    const isComplete = result?.result === 'COMPLETED';
    const headline = isSubmitting
      ? 'Saving Result...'
      : isComplete
        ? 'Level Cleared'
        : 'Level Failed';
    const body = isSubmitting
      ? 'Updating your progress, stars, and score for this run.'
      : isComplete
        ? 'The stage is cleared. You can replay it or move on to the next challenge.'
        : 'The run ended before the stage was cleared. Retry the level to keep progressing.';
    const stats = [
      {
        label: 'Stars',
        value: isSubmitting ? '...' : Number(result?.starsEarned || 0),
        tone: 'amber'
      },
      {
        label: 'Score',
        value: isSubmitting ? '...' : (result?.finalScore ?? '--'),
        tone: 'slate'
      },
      {
        label: 'Coins',
        value: `${gameplay?.coinsCollected ?? 0}/${gameplay?.totalCoins ?? 0}`,
        tone: 'emerald'
      }
    ];

    const buttons = isSubmitting
      ? []
      : [
        ...(isComplete && canAdvanceLevel ? [{
          label: 'Next Level',
          tone: 'primary',
          onClick: () => {
            this.hideMenu('result');
            onNextLevel?.();
          }
        }] : []),
        {
          label: isFailure ? 'Retry Level' : 'Play Again',
          tone: isComplete && canAdvanceLevel ? 'secondary' : 'primary',
          onClick: () => {
            this.hideMenu('result');
            onRetry?.();
          }
        },
        {
          label: 'Back To Levels',
          tone: 'muted',
          onClick: () => {
            this.hideMenu('result');
            onBack?.();
          }
        }
      ];

    this.showPanel({
      mode: 'result',
      kicker: 'Game 1 Result',
      title: headline,
      body,
      stats,
      buttons,
      titleColor: isFailure ? '#7f1d1d' : '#1f2937',
      kickerColor: isFailure ? '#b91c1c' : '#166534',
    });
  }

  showPanel({
    mode,
    kicker,
    title,
    body,
    stats = [],
    buttons = [],
    titleColor = '#1f2937',
    kickerColor = '#166534',
  }) {
    this.hideMenu();
    this.mode = mode;
    this.scene.bringToTop();

    this.overlay.setVisible(true);
    this.overlay.setInteractive();

    this.panel = this.rexUI.add.sizer({
      x: 640,
      y: 360,
      width: 760,
      orientation: 'y',
      space: {
        left: 30,
        right: 30,
        top: 30,
        bottom: 30,
        item: 18,
      }
    });

    this.panel.addBackground(
      this.rexUI.add.roundRectangle(0, 0, 760, 0, 28, 0xf5e8ce, 1)
        .setStrokeStyle(4, 0x4a3721, 1)
    );

    const kickerText = this.add.text(0, 0, kicker, {
      fontFamily: 'Georgia',
      fontSize: '18px',
      fontStyle: 'bold',
      color: kickerColor,
    }).setOrigin(0.5);

    const titleText = this.add.text(0, 0, title, {
      fontFamily: 'Georgia',
      fontSize: '40px',
      fontStyle: 'bold',
      color: titleColor,
      align: 'center',
    }).setOrigin(0.5);

    const bodyText = this.add.text(0, 0, body, {
      fontFamily: 'Georgia',
      fontSize: '20px',
      color: '#4b5563',
      align: 'center',
      wordWrap: { width: 620 },
      lineSpacing: 6,
    }).setOrigin(0.5);

    this.panel.add(kickerText, 0, 'center', 0, false);
    this.panel.add(titleText, 0, 'center', 0, false);
    this.panel.add(bodyText, 0, 'center', { left: 10, right: 10 }, false);

    if (stats.length > 0) {
      const statsRow = this.rexUI.add.sizer({
        orientation: 'x',
        space: { item: 14 }
      });

      stats.forEach((stat) => {
        statsRow.add(this.createStatCard(stat), 0, 'center', 0, false);
      });

      this.panel.add(statsRow, 0, 'center', { top: 4 }, false);
    }

    if (buttons.length > 0) {
      const actionRow = this.rexUI.add.sizer({
        orientation: 'x',
        space: { item: 12 }
      });

      buttons.forEach((buttonConfig) => {
        actionRow.add(this.createActionButton(buttonConfig), 0, 'center', 0, false);
      });

      this.panel.add(actionRow, 0, 'center', { top: 8 }, false);
    }

    this.panel.layout();
    this.panel.setDepth(510);
  }

  createStatCard({ label, value, tone = 'slate' }) {
    const palette = STAT_TONES[tone] || STAT_TONES.slate;
    const card = this.rexUI.add.sizer({
      width: 208,
      height: 118,
      orientation: 'y',
      space: {
        left: 16,
        right: 16,
        top: 16,
        bottom: 16,
        item: 8,
      }
    });

    card.addBackground(
      this.rexUI.add.roundRectangle(0, 0, 208, 118, 20, palette.fill, 1)
        .setStrokeStyle(2, palette.stroke, 1)
    );

    card.add(this.add.text(0, 0, label.toUpperCase(), {
      fontFamily: 'Georgia',
      fontSize: '14px',
      fontStyle: 'bold',
      color: palette.label,
      align: 'center',
    }).setOrigin(0.5), 0, 'center', 0, false);

    card.add(this.add.text(0, 0, String(value), {
      fontFamily: 'Georgia',
      fontSize: '32px',
      fontStyle: 'bold',
      color: palette.value,
      align: 'center',
    }).setOrigin(0.5), 0, 'center', 0, false);

    card.layout();
    return card;
  }

  createActionButton({ label, tone = 'muted', onClick }) {
    const palette = BUTTON_TONES[tone] || BUTTON_TONES.muted;
    const background = this.rexUI.add.roundRectangle(0, 0, 212, 58, 18, palette.fill, 1)
      .setStrokeStyle(3, palette.stroke, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Georgia',
      fontSize: '20px',
      fontStyle: 'bold',
      color: palette.text,
      align: 'center',
    }).setOrigin(0.5);

    const button = this.rexUI.add.label({
      width: 212,
      height: 58,
      background,
      text,
      align: 'center',
      space: {
        left: 18,
        right: 18,
        top: 12,
        bottom: 12,
      }
    });

    button.layout();
    background.setInteractive({ useHandCursor: true });
    background.on('pointerover', () => {
      background.setFillStyle(palette.hoverFill, 1);
    });
    background.on('pointerout', () => {
      background.setFillStyle(palette.fill, 1);
    });
    background.on('pointerup', () => {
      onClick?.();
    });

    return button;
  }
}
