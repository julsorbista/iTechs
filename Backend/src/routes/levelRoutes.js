const express = require('express');
const {
  getMyGames,
  getMyLevels,
  startLevelSession,
  submitLevelSession,
  getMyLevelHistory,
  getPlayableLevelContent
} = require('../controllers/levelController');
const {
  authenticateToken,
  requireStudent
} = require('../middleware/auth');
const {
  gameTypeParamValidation,
  gameTypeQueryValidation,
  gameLevelNumberValidation,
  levelSessionSubmitValidation
} = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);
router.use(requireStudent);

/**
 * @route   GET /api/levels/games/me
 * @desc    Get student game catalog and per-game progress
 * @access  Private (Student)
 */
router.get('/games/me', getMyGames);

/**
 * @route   GET /api/levels/me?gameType=GAME_ONE
 * @desc    Get student level progression for a single game track
 * @access  Private (Student)
 */
router.get('/me', gameTypeQueryValidation(), getMyLevels);

/**
 * @route   GET /api/levels/:gameType/:levelNumber/content
 * @desc    Get published level content for student gameplay
 * @access  Private (Student)
 */
router.get('/:gameType/:levelNumber/content', gameTypeParamValidation(), gameLevelNumberValidation(), getPlayableLevelContent);

/**
 * @route   GET /api/levels/:gameType/:levelNumber/history
 * @desc    Get level attempt history for a specific game track
 * @access  Private (Student)
 */
router.get('/:gameType/:levelNumber/history', gameTypeParamValidation(), gameLevelNumberValidation(), getMyLevelHistory);

/**
 * @route   POST /api/levels/:gameType/:levelNumber/sessions/start
 * @desc    Start a game-scoped level session
 * @access  Private (Student)
 */
router.post('/:gameType/:levelNumber/sessions/start', gameTypeParamValidation(), gameLevelNumberValidation(), startLevelSession);

/**
 * @route   POST /api/levels/:gameType/:levelNumber/sessions/:sessionId/submit
 * @desc    Submit a game-scoped level session payload
 * @access  Private (Student)
 */
router.post('/:gameType/:levelNumber/sessions/:sessionId/submit', gameTypeParamValidation(), gameLevelNumberValidation(), levelSessionSubmitValidation(), submitLevelSession);

module.exports = router;
