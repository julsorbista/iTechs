const express = require('express');
const {
  getLevelCatalog,
  getLevelContent,
  updateLevelDraft,
  publishLevel,
} = require('../controllers/adminLevelController');
const {
  authenticateToken,
  requireSuperAdmin,
} = require('../middleware/auth');
const {
  gameTypeParamValidation,
  gameLevelNumberValidation,
  levelContentDraftValidation,
} = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get('/catalog', getLevelCatalog);
router.get('/:gameType/:levelNumber/content', gameTypeParamValidation(), gameLevelNumberValidation(), getLevelContent);
router.put('/:gameType/:levelNumber/content/draft', gameTypeParamValidation(), gameLevelNumberValidation(), levelContentDraftValidation(), updateLevelDraft);
router.post('/:gameType/:levelNumber/content/publish', gameTypeParamValidation(), gameLevelNumberValidation(), publishLevel);

module.exports = router;
