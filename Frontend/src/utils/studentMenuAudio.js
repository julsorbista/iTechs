const MENU_AUDIO_SRC = new URL(
  '../../assets/Game/game_one/Music & Sound Effects/bg_sound/menu_Sound.mp3',
  import.meta.url,
).href;

const PREFERENCES_KEY = 'studentMenuPreferences';
const PRIME_KEY = 'studentMenuAudioPrime';

let audioInstance = null;
let pendingPlayPromise = null;

const canUseAudio = () => (
  typeof window !== 'undefined'
  && typeof window.Audio !== 'undefined'
);

const ensureAudio = () => {
  if (!canUseAudio()) {
    return null;
  }

  if (!audioInstance) {
    audioInstance = new Audio(MENU_AUDIO_SRC);
    audioInstance.loop = true;
    audioInstance.preload = 'auto';
    audioInstance.volume = 0.55;
  }

  return audioInstance;
};

export const getStudentMusicPreference = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return true;
    }

    const parsed = JSON.parse(raw);
    return parsed?.music !== false;
  } catch (error) {
    return true;
  }
};

export const markStudentMenuAudioPrimed = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(PRIME_KEY, '1');
  } catch (error) {
    // Ignore storage failures in restricted contexts.
  }
};

export const consumeStudentMenuAudioPrimed = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const value = window.sessionStorage.getItem(PRIME_KEY);
    if (value !== '1') {
      return false;
    }

    window.sessionStorage.removeItem(PRIME_KEY);
    return true;
  } catch (error) {
    return false;
  }
};

export const startStudentMenuLoop = async ({ ignorePreference = false } = {}) => {
  const audio = ensureAudio();
  if (!audio) {
    return { started: false, blocked: false };
  }

  if (!ignorePreference && !getStudentMusicPreference()) {
    stopStudentMenuLoop({ rewind: false });
    return { started: false, blocked: false };
  }

  if (!audio.paused) {
    return { started: true, blocked: false };
  }

  try {
    pendingPlayPromise = pendingPlayPromise || audio.play();
    await pendingPlayPromise;
    return { started: true, blocked: false };
  } catch (error) {
    return { started: false, blocked: true };
  } finally {
    pendingPlayPromise = null;
  }
};

export const stopStudentMenuLoop = ({ rewind = false } = {}) => {
  if (!audioInstance) {
    return;
  }

  audioInstance.pause();
  if (rewind) {
    audioInstance.currentTime = 0;
  }
};

export const syncStudentMenuLoopToPreference = async () => {
  if (getStudentMusicPreference()) {
    return startStudentMenuLoop();
  }

  stopStudentMenuLoop({ rewind: false });
  return { started: false, blocked: false };
};
