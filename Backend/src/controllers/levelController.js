const {
  successResponse,
  errorResponse
} = require('../utils/helpers');
const {
  getStudentGameCatalog,
  getStudentProgression,
  startGameSession,
  submitGameSession,
  getLevelHistory
} = require('../services/progressionService');
const { getPublishedLevelContent } = require('../services/levelContentService');

const getMyGames = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(errorResponse('Only students can access game progression'));
    }

    const gameCatalog = await getStudentGameCatalog(req.user.id);

    return res.status(200).json(
      successResponse(gameCatalog, 'Game progression retrieved successfully')
    );
  } catch (error) {
    return next(error);
  }
};

const getMyLevels = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(errorResponse('Only students can access level progression'));
    }

    const { gameType } = req.query;
    const progression = await getStudentProgression(req.user.id, gameType);

    return res.status(200).json(
      successResponse(progression, 'Level progression retrieved successfully')
    );
  } catch (error) {
    return res.status(400).json(errorResponse(error.message || 'Failed to retrieve level progression'));
  }
};

const startLevelSession = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(errorResponse('Only students can start level sessions'));
    }

    const { gameType, levelNumber } = req.params;
    const session = await startGameSession(req.user.id, gameType, levelNumber);

    return res.status(201).json(
      successResponse(session, 'Level session started successfully')
    );
  } catch (error) {
    return res.status(400).json(errorResponse(error.message || 'Failed to start level session'));
  }
};

const submitLevelSession = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(errorResponse('Only students can submit level sessions'));
    }

    const { gameType, levelNumber, sessionId } = req.params;
    const result = await submitGameSession(req.user.id, gameType, levelNumber, sessionId, req.body || {});

    return res.status(200).json(
      successResponse(result, 'Level session submitted successfully')
    );
  } catch (error) {
    return res.status(400).json(errorResponse(error.message || 'Failed to submit level session'));
  }
};

const getMyLevelHistory = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(errorResponse('Only students can access level history'));
    }

    const { gameType, levelNumber } = req.params;
    const { limit = 10 } = req.query;

    const history = await getLevelHistory(req.user.id, gameType, levelNumber, limit);

    return res.status(200).json(
      successResponse(history, 'Level history retrieved successfully')
    );
  } catch (error) {
    return res.status(400).json(errorResponse(error.message || 'Failed to retrieve level history'));
  }
};

const getPlayableLevelContent = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(errorResponse('Only students can access playable level content'));
    }

    const { gameType, levelNumber } = req.params;
    const prefetchRaw = typeof req.query.prefetch === 'string' ? req.query.prefetch.trim().toLowerCase() : '';
    const skipDynamicQuestions = prefetchRaw === '1' || prefetchRaw === 'true' || prefetchRaw === 'yes';
    const content = await getPublishedLevelContent(gameType, levelNumber, {
      skipDynamicQuestions,
      teacherId: req.user.teacherId || null,
      allowMissing: skipDynamicQuestions,
      studentId: req.user.id,
      loginSessionKey: req.authSessionKey || '',
    });

    return res.status(200).json(
      successResponse(content, 'Playable level content retrieved successfully')
    );
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    const resolvedStatus = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600
      ? statusCode
      : ((error?.message || '').toLowerCase().includes('not found') ? 404 : 400);

    return res.status(resolvedStatus).json(errorResponse(error.message || 'Failed to retrieve playable level content'));
  }
};

module.exports = {
  getMyGames,
  getMyLevels,
  startLevelSession,
  submitLevelSession,
  getMyLevelHistory,
  getPlayableLevelContent
};
