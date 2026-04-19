const express = require('express');
const { generateAiQuestion } = require('../controllers/adminAiController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.post('/questions/generate', generateAiQuestion);

module.exports = router;
