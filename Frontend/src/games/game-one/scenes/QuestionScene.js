import Phaser from 'phaser';

export default class QuestionScene extends Phaser.Scene {
  constructor() {
    super('QuestionScene');
  }

  init(data) {
    this.question = data.question;
    this.questionId = data.questionId;
    this.hasAnswered = false;
    this.hintIndex = 0;
  }

  create() {
    const sceneWidth = this.scale.width;
    const sceneHeight = this.scale.height;
    const centerX = sceneWidth / 2;
    const centerY = sceneHeight / 2;

    const panelWidth = Math.min(sceneWidth - 120, 900);
    const panelHeight = Math.min(sceneHeight - 80, 580);
    const panelTop = centerY - (panelHeight / 2);
    const panelBottom = centerY + (panelHeight / 2);
    const panelLeft = centerX - (panelWidth / 2);
    const panelRight = centerX + (panelWidth / 2);
    const cleanupHandlers = [];

    const overlay = this.add.rectangle(centerX, centerY, sceneWidth, sceneHeight, 0x020617, 0.72);
    overlay.setInteractive();

    this.add.ellipse(sceneWidth * 0.2, sceneHeight * 0.18, sceneWidth * 0.33, sceneHeight * 0.3, 0x2563eb, 0.12);
    this.add.ellipse(sceneWidth * 0.82, sceneHeight * 0.82, sceneWidth * 0.44, sceneHeight * 0.34, 0xb45309, 0.12);
    this.add.ellipse(centerX, centerY, sceneWidth * 0.84, sceneHeight * 0.88, 0x000000, 0.16);

    this.add.rectangle(centerX + 8, centerY + 10, panelWidth + 20, panelHeight + 20, 0x120d06, 0.46);
    const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xf4e3b2, 0.98);
    panel.setStrokeStyle(5, 0x4a3721, 1);

    this.add.rectangle(centerX, centerY, panelWidth - 52, panelHeight - 54, 0xfbf3d5, 0.74).setStrokeStyle(2, 0x7c5c3f, 0.9);

    const titleBarHeight = 56;
    const titleBarY = panelTop + (titleBarHeight / 2) + 10;
    this.add.rectangle(centerX, titleBarY, panelWidth - 72, titleBarHeight, 0x5b4024, 1).setStrokeStyle(3, 0xe8d39a, 0.92);
    this.add.rectangle(panelLeft + 38, titleBarY, 14, 14, 0xe8c36a, 1).setAngle(45);
    this.add.rectangle(panelRight - 38, titleBarY, 14, 14, 0xe8c36a, 1).setAngle(45);

    this.add.text(centerX, titleBarY, 'Ancient Riddle', {
      fontFamily: 'Georgia',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#fff4d6'
    }).setOrigin(0.5).setScale(0.68);

    const rawChoices = Array.isArray(this.question?.choices)
      ? this.question.choices
      : [];
    const normalizedChoices = rawChoices.length >= 2
      ? rawChoices
      : ['A', 'B', 'C', 'D'];

    const choiceCount = normalizedChoices.length;
    let optionHeight = choiceCount >= 6 ? 42 : (choiceCount >= 5 ? 46 : 52);
    let optionGap = choiceCount >= 5 ? 10 : 12;
    const feedbackReserve = 96;
    const promptTop = titleBarY + 42;
    let optionsTotalHeight = (choiceCount * optionHeight) + ((choiceCount - 1) * optionGap);
    let maxPromptHeight = Math.floor(panelBottom - feedbackReserve - optionsTotalHeight - promptTop - 18);

    if (maxPromptHeight < 90) {
      optionHeight = Math.max(36, optionHeight - 8);
      optionGap = Math.max(8, optionGap - 2);
      optionsTotalHeight = (choiceCount * optionHeight) + ((choiceCount - 1) * optionGap);
      maxPromptHeight = Math.floor(panelBottom - feedbackReserve - optionsTotalHeight - promptTop - 18);
    }

    maxPromptHeight = Math.max(88, maxPromptHeight);

    const promptBoxWidth = panelWidth - 80;
    const promptViewportWidth = promptBoxWidth - 24;
    const promptSource = typeof this.question?.prompt === 'string' && this.question.prompt.trim()
      ? this.question.prompt.trim()
      : 'Solve the riddle.';

    let promptFontSize = 24;
    const minPromptFontSize = 16;

    const createPromptText = (fontSize) => {
      const promptText = this.add.text(centerX, promptTop + 14, promptSource, {
        fontFamily: 'Georgia',
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: '#2b1d0e',
        wordWrap: { width: promptViewportWidth - 20 },
        align: 'center',
      });
      promptText.setOrigin(0.5, 0);
      return promptText;
    };

    let promptText = createPromptText(promptFontSize);
    while (promptText.height > maxPromptHeight - 20 && promptFontSize > minPromptFontSize) {
      promptText.destroy();
      promptFontSize -= 1;
      promptText = createPromptText(promptFontSize);
    }

    const promptBoxHeight = Math.max(98, Math.min(maxPromptHeight, Math.ceil(promptText.height + 24)));
    const promptBoxY = promptTop + (promptBoxHeight / 2);
    const promptBox = this.add.rectangle(centerX, promptBoxY, promptBoxWidth, promptBoxHeight, 0xe9d39f, 1).setStrokeStyle(2, 0x7c5c3f, 0.9);
    promptBox.setDepth(20);

    const promptViewportTop = promptBoxY - (promptBoxHeight / 2) + 10;
    const promptViewportHeight = promptBoxHeight - 20;
    promptText.setWordWrapWidth(promptViewportWidth - 20, true);
    promptText.setY(promptViewportTop);
    promptText.setDepth(30);

    const promptMask = this.make.graphics();
    promptMask.setVisible(false);
    promptMask.fillStyle(0xffffff, 1);
    promptMask.fillRect(
      centerX - (promptViewportWidth / 2),
      promptViewportTop,
      promptViewportWidth,
      promptViewportHeight,
    );
    promptText.setMask(promptMask.createGeometryMask());

    const promptMaxScroll = Math.max(0, promptText.height - promptViewportHeight);
    let promptScrollOffset = 0;
    let isDraggingPrompt = false;
    let previousDragY = 0;
    const promptBounds = new Phaser.Geom.Rectangle(
      centerX - (promptViewportWidth / 2),
      promptViewportTop,
      promptViewportWidth,
      promptViewportHeight,
    );

    let scrollUpButton = null;
    let scrollDownButton = null;

    const updatePromptScroll = (nextOffset) => {
      promptScrollOffset = Phaser.Math.Clamp(nextOffset, 0, promptMaxScroll);
      promptText.setY(promptViewportTop - promptScrollOffset);

      if (scrollUpButton) {
        scrollUpButton.setAlpha(promptScrollOffset <= 0 ? 0.45 : 1);
      }

      if (scrollDownButton) {
        scrollDownButton.setAlpha(promptScrollOffset >= promptMaxScroll ? 0.45 : 1);
      }
    };

    if (promptMaxScroll > 0) {
      this.add.text(centerX, promptBoxY + (promptBoxHeight / 2) - 10, 'Scroll to read full question', {
        fontFamily: 'Georgia',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#7c5c3f',
      }).setOrigin(0.5, 1).setDepth(31);

      scrollUpButton = this.add.text(panelRight - 30, promptBoxY - 16, '▲', {
        fontFamily: 'Georgia',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#2b1d0e',
      }).setOrigin(0.5).setDepth(31);

      scrollDownButton = this.add.text(panelRight - 30, promptBoxY + 16, '▼', {
        fontFamily: 'Georgia',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#2b1d0e',
      }).setOrigin(0.5).setDepth(31);

      [scrollUpButton, scrollDownButton].forEach((button, index) => {
        button.setInteractive({ useHandCursor: true });

        const direction = index === 0 ? -1 : 1;
        button.on('pointerup', () => {
          updatePromptScroll(promptScrollOffset + (direction * 40));
        });
      });

      const wheelHandler = (pointer, _gameObjects, _deltaX, deltaY) => {
        if (!Phaser.Geom.Rectangle.Contains(promptBounds, pointer.x, pointer.y)) {
          return;
        }

        const direction = Math.sign(deltaY);
        if (!direction) {
          return;
        }

        updatePromptScroll(promptScrollOffset + (direction * 36));
      };

      const pointerDownHandler = (pointer) => {
        if (!Phaser.Geom.Rectangle.Contains(promptBounds, pointer.x, pointer.y)) {
          return;
        }

        isDraggingPrompt = true;
        previousDragY = pointer.y;
      };

      const pointerMoveHandler = (pointer) => {
        if (!isDraggingPrompt || !pointer.isDown) {
          return;
        }

        const deltaY = pointer.y - previousDragY;
        previousDragY = pointer.y;
        updatePromptScroll(promptScrollOffset - deltaY);
      };

      const pointerUpHandler = () => {
        isDraggingPrompt = false;
      };

      this.input.on('wheel', wheelHandler);
      this.input.on('pointerdown', pointerDownHandler);
      this.input.on('pointermove', pointerMoveHandler);
      this.input.on('pointerup', pointerUpHandler);
      this.input.on('pointerupoutside', pointerUpHandler);

      cleanupHandlers.push(() => this.input.off('wheel', wheelHandler));
      cleanupHandlers.push(() => this.input.off('pointerdown', pointerDownHandler));
      cleanupHandlers.push(() => this.input.off('pointermove', pointerMoveHandler));
      cleanupHandlers.push(() => this.input.off('pointerup', pointerUpHandler));
      cleanupHandlers.push(() => this.input.off('pointerupoutside', pointerUpHandler));

      updatePromptScroll(0);
    }

    const optionButtons = [];
    const optionsTop = promptBoxY + (promptBoxHeight / 2) + 18;
    const optionWidth = panelWidth - 80;
    const firstOptionY = optionsTop + (optionHeight / 2);
    const medallionRadius = choiceCount >= 5 ? 15 : 18;
    const numberFontSize = choiceCount >= 5 ? '16px' : '18px';
    const optionFontSize = choiceCount >= 5 ? '16px' : '18px';
    const optionLabelX = centerX - (optionWidth / 2) + 84;

    normalizedChoices.forEach((choice, index) => {
      const y = firstOptionY + (index * (optionHeight + optionGap));
      const optionShadow = this.add.rectangle(centerX + 6, y + 4, optionWidth, optionHeight, 0x2b1d0e, 0.18);
      const optionBackground = this.add.rectangle(centerX, y, optionWidth, optionHeight, 0xfff6dc, 1);
      optionBackground.setStrokeStyle(3, 0x7c5c3f, 1);
      optionBackground.setInteractive({ useHandCursor: true });

      const numberMedallion = this.add.circle(centerX - (optionWidth / 2) + 42, y, medallionRadius, 0x6b4b2c, 1);
      numberMedallion.setStrokeStyle(2, 0xf4d38c, 0.92);

      const numberLabel = this.add.text(numberMedallion.x, y, `${index + 1}`, {
        fontFamily: 'Georgia',
        fontSize: numberFontSize,
        fontStyle: 'bold',
        color: '#fff7e2'
      }).setOrigin(0.5);

      const optionLabel = this.add.text(optionLabelX, y, choice, {
        fontFamily: 'Georgia',
        fontSize: optionFontSize,
        color: '#2b1d0e',
        wordWrap: { width: optionWidth - 118 }
      }).setOrigin(0, 0.5);

      optionButtons.push({
        optionBackground,
        optionShadow,
        numberMedallion,
        numberLabel,
        optionLabel
      });

      optionBackground.on('pointerover', () => {
        if (this.hasAnswered) {
          return;
        }

        optionBackground.setFillStyle(0xf8ecd0, 1);
        optionBackground.setScale(1.01);
        optionShadow.setAlpha(0.28);
      });

      optionBackground.on('pointerout', () => {
        if (this.hasAnswered) {
          return;
        }

        optionBackground.setFillStyle(0xfff6dc, 1);
        optionBackground.setScale(1);
        optionShadow.setAlpha(0.18);
      });

      optionBackground.on('pointerup', () => {
        if (this.hasAnswered) {
          return;
        }

        this.hasAnswered = true;
        const answerIndexRaw = Number(this.question?.answerIndex);
        const answerIndex = Number.isInteger(answerIndexRaw)
          ? Phaser.Math.Clamp(answerIndexRaw, 0, normalizedChoices.length - 1)
          : 0;
        const correct = index === answerIndex;
        const fillColor = correct ? 0xc7f9cc : 0xfed2d2;
        const strokeColor = correct ? 0x166534 : 0xb91c1c;
        const medallionColor = correct ? 0x166534 : 0x991b1b;
        const labelColor = correct ? '#14532d' : '#7f1d1d';

        optionButtons.forEach((button) => {
          button.optionBackground.disableInteractive();
          if (button.optionBackground !== optionBackground) {
            button.optionBackground.setAlpha(0.58);
            button.optionShadow.setAlpha(0.08);
            button.numberMedallion.setAlpha(0.48);
            button.numberLabel.setAlpha(0.48);
            button.optionLabel.setAlpha(0.58);
          }
        });

        optionBackground.setFillStyle(fillColor, 1);
        optionBackground.setStrokeStyle(3, strokeColor, 1);
        numberMedallion.setFillStyle(medallionColor, 1);
        optionLabel.setColor(labelColor);
        this.feedbackText.setColor(labelColor);

        const explanation = typeof this.question?.explanation === 'string'
          ? this.question.explanation.trim()
          : '';

        const successText = typeof this.question?.successText === 'string' && this.question.successText.trim()
          ? this.question.successText.trim()
          : 'Correct!';
        const failureText = typeof this.question?.failureText === 'string' && this.question.failureText.trim()
          ? this.question.failureText.trim()
          : 'Not quite. Try again.';
        const feedbackBase = correct ? successText : failureText;
        this.feedbackText.setText(explanation ? `${feedbackBase}\n${explanation}` : feedbackBase);

        this.tweens.add({
          targets: [optionBackground, optionShadow],
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 120,
          yoyo: true
        });

        this.time.delayedCall(460, () => {
          const levelScene = this.scene.get('LevelScene');
          levelScene.events.emit('question:answered', {
            questionId: this.questionId,
            correct
          });
          this.scene.stop();
        });
      });
    });

    this.feedbackText = this.add.text(centerX, panelBottom - 58, '', {
      fontFamily: 'Georgia',
      fontSize: '15px',
      color: '#4a3721',
      wordWrap: { width: panelWidth - 92 },
      align: 'center'
    }).setOrigin(0.5);

    const hints = Array.isArray(this.question?.hints)
      ? this.question.hints
        .map((hint) => (typeof hint === 'string' ? hint.trim() : ''))
        .filter(Boolean)
      : [];

    this.hintText = this.add.text(centerX, panelBottom - 24, '', {
      fontFamily: 'Georgia',
      fontSize: '13px',
      color: '#475569',
      wordWrap: { width: panelWidth - 92 },
      align: 'center'
    }).setOrigin(0.5);

    if (hints.length > 0) {
      const hintButtonShadow = this.add.rectangle(panelRight - 84, titleBarY + 3, 128, 38, 0x2b1d0e, 0.2);
      const hintButton = this.add.rectangle(panelRight - 90, titleBarY, 128, 38, 0xe6d3a1, 1);
      hintButton.setStrokeStyle(2, 0x7c5c3f, 1);
      hintButton.setInteractive({ useHandCursor: true });

      const hintLabel = this.add.text(panelRight - 90, titleBarY, 'Show Hint', {
        fontFamily: 'Georgia',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#2b1d0e'
      }).setOrigin(0.5);

      hintButton.on('pointerover', () => {
        if (this.hasAnswered) {
          return;
        }

        hintButton.setFillStyle(0xf2dfb0, 1);
      });

      hintButton.on('pointerout', () => {
        if (this.hasAnswered) {
          return;
        }

        hintButton.setFillStyle(0xe6d3a1, 1);
      });

      hintButton.on('pointerup', () => {
        if (this.hasAnswered) {
          return;
        }

        const nextHint = hints[this.hintIndex % hints.length];
        this.hintIndex += 1;
        this.hintText.setText(`Hint: ${nextHint}`);
      });

      cleanupHandlers.push(() => hintButton.removeAllListeners());
      cleanupHandlers.push(() => hintLabel.destroy());
      cleanupHandlers.push(() => hintButtonShadow.destroy());
    }

    this.events.once('shutdown', () => {
      cleanupHandlers.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Ignore cleanup errors during scene shutdown.
        }
      });
      promptMask.destroy();
    });
  }
}
