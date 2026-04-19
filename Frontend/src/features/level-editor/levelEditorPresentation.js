import {
  buildBackgroundLookup,
  doesObjectIntersectCell,
  getCellBounds,
  getDefaultTextureKey,
  getLevelEditorObjectBounds,
} from './levelEditorUtils';

const buildAssetLookups = (source) => {
  const imagesByKey = Object.fromEntries(
    (source?.runtimeAssets?.images || []).map((entry) => [entry.key, entry.url]),
  );
  const sheetsByKey = Object.fromEntries(
    (source?.runtimeAssets?.spritesheets || []).map((entry) => [entry.key, entry]),
  );

  return { imagesByKey, sheetsByKey };
};

export const getPalettePreview = (type, source) => {
  const manifest = source?.runtimeAssets?.manifest || {};
  const { imagesByKey, sheetsByKey } = buildAssetLookups(source);
  const defaultTextureKey = getDefaultTextureKey(source);

  if (type === 'spawn') {
    return {
      kind: 'sheet',
      sheet: sheetsByKey[manifest.player?.key],
      frameWidth: manifest.player?.frameWidth || 96,
      frameHeight: manifest.player?.frameHeight || 96,
      accent: 'border-sky-200 bg-sky-50',
    };
  }

  if (['platforms', 'unlockPlatforms', 'barriers'].includes(type)) {
    const texture = manifest.platforms?.[defaultTextureKey] || Object.values(manifest.platforms || {})[0];
    return {
      kind: 'tile',
      url: imagesByKey[texture?.key],
      accent: type === 'barriers' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50',
    };
  }

  if (type === 'coins') {
    return {
      kind: 'sheet',
      sheet: sheetsByKey[manifest.coin?.key],
      frameWidth: manifest.coin?.frameWidth || 64,
      frameHeight: manifest.coin?.frameHeight || 64,
      accent: 'border-amber-200 bg-amber-50',
    };
  }

  if (type === 'ghosts') {
    return {
      kind: 'sheet',
      sheet: sheetsByKey[manifest.ghost?.key],
      frameWidth: manifest.ghost?.frameWidth || 80,
      frameHeight: manifest.ghost?.frameHeight || 80,
      accent: 'border-violet-200 bg-violet-50',
    };
  }

  if (type === 'projectileEnemies') {
    return {
      kind: 'sheet',
      sheet: sheetsByKey[manifest.projectileCaster?.key],
      frameWidth: manifest.projectileCaster?.frameWidth || 123,
      frameHeight: manifest.projectileCaster?.frameHeight || 123,
      accent: 'border-rose-200 bg-rose-50',
    };
  }

  if (type === 'villain') {
    return {
      kind: 'image',
      url: imagesByKey[manifest.villain?.key],
      accent: 'border-orange-200 bg-orange-50',
      contain: true,
    };
  }

  if (type === 'portal') {
    return {
      kind: 'sheet',
      sheet: sheetsByKey[manifest.portal?.key],
      frameWidth: manifest.portal?.frameWidth || 128,
      frameHeight: manifest.portal?.frameHeight || 256,
      accent: 'border-cyan-200 bg-cyan-50',
    };
  }

  return {
    kind: 'fallback',
    accent: 'border-slate-200 bg-slate-50',
  };
};

export const getBackgroundPreview = (backgroundKey, source) => {
  const backgroundLookup = buildBackgroundLookup(source);
  return backgroundLookup[backgroundKey] || '';
};

export const groupFieldDefinitions = (fields = []) => {
  const grouped = [];

  fields.forEach((field) => {
    const groupName = field.group || 'General';
    const existingGroup = grouped.find((group) => group.label === groupName);

    if (existingGroup) {
      existingGroup.fields.push(field);
      return;
    }

    grouped.push({
      label: groupName,
      fields: [field],
    });
  });

  return grouped;
};

const hasQuestionId = (levelData, questionId) => (
  Boolean(questionId)
  && (levelData?.questions || []).some((question) => question.id === questionId)
);

const getWorldBounds = (levelData) => {
  const cells = Array.isArray(levelData?.grid?.cells) ? levelData.grid.cells : [];
  const viewport = levelData?.viewport || { width: 1280, height: 720 };

  if (!cells.length) {
    return {
      left: 0,
      top: 0,
      right: viewport.width,
      bottom: viewport.height,
    };
  }

  const cols = cells.map((cell) => Number(cell.col || 0));
  const rows = cells.map((cell) => Number(cell.row || 0));

  return {
    left: Math.min(...cols) * viewport.width,
    top: Math.min(...rows) * viewport.height,
    right: (Math.max(...cols) + 1) * viewport.width,
    bottom: (Math.max(...rows) + 1) * viewport.height,
  };
};

const getPortalEntries = (levelData) => {
  const rawPortal = levelData?.worldObjects?.portal;
  if (Array.isArray(rawPortal)) {
    return rawPortal.filter(Boolean);
  }

  return rawPortal ? [rawPortal] : [];
};

export const getObjectValidationMessages = ({ entry, levelData, source }) => {
  if (!entry) {
    return [];
  }

  const messages = [];
  const bounds = getLevelEditorObjectBounds(entry, source);
  const worldBounds = getWorldBounds(levelData);
  const cells = levelData?.grid?.cells || [];
  const touchesAnyCell = cells.some((cell) => doesObjectIntersectCell(entry, cell, levelData, source));

  if (
    bounds.left < worldBounds.left
    || bounds.top < worldBounds.top
    || bounds.right > worldBounds.right
    || bounds.bottom > worldBounds.bottom
  ) {
    messages.push({
      id: 'bounds',
      tone: 'warning',
      message: 'The rendered object extends outside the current map bounds.',
    });
  }

  if (!touchesAnyCell) {
    messages.push({
      id: 'outside-cell',
      tone: 'warning',
      message: 'This object is not placed inside any map cell yet.',
    });
  }

  if (entry.type === 'villain') {
    if (!entry.object.questionId) {
      messages.push({
        id: 'missing-question',
        tone: 'warning',
        message: 'Question trigger does not have a linked question yet.',
      });
    } else if (!hasQuestionId(levelData, entry.object.questionId)) {
      messages.push({
        id: 'invalid-question',
        tone: 'danger',
        message: 'Question trigger points to a question id that does not exist in this level.',
      });
    }
  }

  if (['unlockPlatforms', 'barriers'].includes(entry.type)) {
    if (!entry.object.lockedByQuestionId) {
      messages.push({
        id: 'missing-lock',
        tone: 'warning',
        message: 'This unlockable object does not have a question link yet.',
      });
    } else if (!hasQuestionId(levelData, entry.object.lockedByQuestionId)) {
      messages.push({
        id: 'invalid-lock',
        tone: 'danger',
        message: 'The linked question for this unlockable object does not exist.',
      });
    }

    if (entry.type === 'unlockPlatforms' && entry.object.startsHidden && !entry.object.lockedByQuestionId) {
      messages.push({
        id: 'hidden-without-trigger',
        tone: 'warning',
        message: 'Hidden unlock platform has no question trigger, so it may never become visible.',
      });
    }
  }

  if (entry.type === 'portal' && entry.object.questionId && !hasQuestionId(levelData, entry.object.questionId)) {
    messages.push({
      id: 'invalid-portal-question',
      tone: 'danger',
      message: 'Portal lock references a missing question id.',
    });
  }

  return messages;
};

export const getCellValidationMessages = ({ cell, levelData, source, cellObjects = [] }) => {
  if (!cell) {
    return [];
  }

  const messages = cellObjects.flatMap((entry) => (
    getObjectValidationMessages({
      entry,
      levelData,
      source,
    }).map((message) => ({
      ...message,
      id: `${entry.editorId}-${message.id}`,
    }))
  ));

  const cellBounds = getCellBounds(cell, levelData?.viewport);
  const cellHasSpawn = cellObjects.some((entry) => entry.type === 'spawn');
  const cellHasPortal = cellObjects.some((entry) => entry.type === 'portal');

  if (cellHasSpawn && cellHasPortal) {
    messages.push({
      id: `cell-${cell.id}-spawn-portal-overlap`,
      tone: 'warning',
      message: 'Spawn and completion portal share the same cell. That can make the finish too immediate.',
    });
  }

  if ((cellBounds.right - cellBounds.left) <= 0 || (cellBounds.bottom - cellBounds.top) <= 0) {
    messages.push({
      id: `cell-${cell.id}-invalid-size`,
      tone: 'danger',
      message: 'This cell does not resolve to a valid viewport-sized area.',
    });
  }

  return messages;
};

export const getLevelValidationMessages = ({ levelData }) => {
  if (!levelData) {
    return [];
  }

  const messages = [];
  const cellCount = levelData?.grid?.cells?.length || 0;

  if (cellCount === 0) {
    messages.push({
      id: 'level-missing-cells',
      tone: 'danger',
      message: 'Add at least one map cell before saving this level.',
    });
  }

  if (!levelData?.worldObjects?.spawn) {
    messages.push({
      id: 'level-missing-spawn',
      tone: 'danger',
      message: 'Place one spawn point so the player has somewhere to enter the map.',
    });
  }

  if (getPortalEntries(levelData).length === 0) {
    messages.push({
      id: 'level-missing-portal',
      tone: 'warning',
      message: 'Place one completion portal somewhere in the map so students can finish the level.',
    });
  }

  return messages;
};

export const getRoomValidationMessages = getLevelValidationMessages;
