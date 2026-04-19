import React, { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import BootScene from '../scenes/BootScene';
import PreloadScene from '../scenes/PreloadScene';
import LevelScene from '../scenes/LevelScene';
import HudScene from '../scenes/HudScene';
import QuestionScene from '../scenes/QuestionScene';
import MenuScene from '../scenes/MenuScene';

const GameCanvas = ({
  levelData,
  runtimeAssets,
  onLevelComplete,
  onLevelFail,
  onExitRequest,
  resultData,
  gameplayData,
  isSubmitting,
  canAdvanceLevel,
  onRetry,
  onBack,
  onNextLevel,
  frameClassName = '',
  canvasHostClassName = '',
}) => {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const callbackRef = useRef({
    onLevelComplete,
    onLevelFail,
    onExitRequest,
  });
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    callbackRef.current = {
      onLevelComplete,
      onLevelFail,
      onExitRequest,
    };
  }, [onLevelComplete, onLevelFail, onExitRequest]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const bootPayload = {
      levelData,
      runtimeAssets,
      callbacks: {
        onPauseChange: setIsPaused,
        onLevelComplete: (...args) => callbackRef.current.onLevelComplete?.(...args),
        onLevelFail: (...args) => callbackRef.current.onLevelFail?.(...args),
        onExitRequest: (...args) => callbackRef.current.onExitRequest?.(...args),
      },
    };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: levelData.viewport.width,
      height: levelData.viewport.height,
      parent: containerRef.current,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#020617',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 1500 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: levelData.viewport.width,
        height: levelData.viewport.height,
      },
      plugins: {
        scene: [
          {
            key: 'rexUI',
            plugin: UIPlugin,
            mapping: 'rexUI',
          }
        ]
      },
      scene: [BootScene, PreloadScene, LevelScene, HudScene, QuestionScene, MenuScene],
      callbacks: {
        preBoot: (instance) => {
          instance.__ITECHS_BOOT__ = bootPayload;
        },
      },
    });

    gameRef.current = game;

    return () => {
      setIsPaused(false);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [levelData, runtimeAssets]);

  const handleResume = useCallback(() => {
    const levelScene = gameRef.current?.scene?.keys?.LevelScene;
    if (levelScene) {
      levelScene.resumeFromOverlay();
    }
  }, []);

  const handleExit = useCallback(() => {
    const levelScene = gameRef.current?.scene?.keys?.LevelScene;
    if (levelScene) {
      levelScene.requestExitFromOverlay();
      return;
    }

    onExitRequest?.();
  }, [onExitRequest]);

  useEffect(() => {
    const menuScene = gameRef.current?.scene?.keys?.MenuScene;
    if (!menuScene || resultData || isSubmitting) {
      return;
    }

    if (isPaused) {
      menuScene.showPauseMenu({
        onResume: handleResume,
        onExit: handleExit,
      });
      return;
    }

    menuScene.hideMenu('pause');
  }, [handleExit, isPaused, isSubmitting, resultData]);

  useEffect(() => {
    const menuScene = gameRef.current?.scene?.keys?.MenuScene;
    if (!menuScene) {
      return;
    }

    if (!resultData && !isSubmitting) {
      menuScene.hideMenu('result');
      return;
    }

    menuScene.showResultMenu({
      result: resultData,
      gameplay: gameplayData,
      isSubmitting,
      canAdvanceLevel,
      onRetry,
      onBack,
      onNextLevel,
    });
  }, [canAdvanceLevel, gameplayData, isSubmitting, onBack, onNextLevel, onRetry, resultData]);

  return (
    <div className={`relative box-border w-full overflow-hidden rounded-[28px] border border-slate-200/70 bg-slate-950 shadow-[0_28px_60px_rgba(15,23,42,0.24)] ${frameClassName}`}>
      <div ref={containerRef} className={`w-full [&>canvas]:w-full! [&>canvas]:h-auto! ${canvasHostClassName}`} />
    </div>
  );
};

export default GameCanvas;
