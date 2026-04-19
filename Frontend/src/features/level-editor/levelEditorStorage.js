import { getStorageKey } from './levelEditorUtils';

export const loadLevelEditorDraft = (gameType, levelNumber) => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(getStorageKey(gameType, levelNumber));
    return storedValue ? JSON.parse(storedValue) : null;
  } catch (error) {
    console.warn('Failed to load level editor draft.', error);
    return null;
  }
};

export const saveLevelEditorDraft = (gameType, levelNumber, levelData) => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      getStorageKey(gameType, levelNumber),
      JSON.stringify(levelData),
    );
    return true;
  } catch (error) {
    console.warn('Failed to save level editor draft.', error);
    return false;
  }
};

export const clearLevelEditorDraft = (gameType, levelNumber) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(gameType, levelNumber));
  } catch (error) {
    console.warn('Failed to clear level editor draft.', error);
  }
};
