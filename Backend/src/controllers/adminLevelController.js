const { successResponse, errorResponse } = require('../utils/helpers');
const {
  getAdminLevelCatalog,
  getAdminLevelContent,
  saveLevelDraft,
  publishLevelContent,
} = require('../services/levelContentService');

const getLevelCatalog = async (req, res, next) => {
  try {
    const catalog = await getAdminLevelCatalog();

    return res.status(200).json(
      successResponse(catalog, 'Admin level catalog retrieved successfully'),
    );
  } catch (error) {
    return next(error);
  }
};

const getLevelContent = async (req, res, next) => {
  try {
    const { gameType, levelNumber } = req.params;
    const content = await getAdminLevelContent(gameType, levelNumber);

    return res.status(200).json(
      successResponse(content, 'Level content retrieved successfully'),
    );
  } catch (error) {
    return res.status(404).json(errorResponse(error.message || 'Failed to retrieve level content'));
  }
};

const updateLevelDraft = async (req, res, next) => {
  try {
    const { gameType, levelNumber } = req.params;
    const { levelData } = req.body;
    const content = await saveLevelDraft(gameType, levelNumber, levelData, req.user.id);

    return res.status(200).json(
      successResponse(content, 'Level draft saved successfully'),
    );
  } catch (error) {
    return res.status(400).json(errorResponse(error.message || 'Failed to save level draft'));
  }
};

const publishLevel = async (req, res, next) => {
  try {
    const { gameType, levelNumber } = req.params;
    const content = await publishLevelContent(gameType, levelNumber, req.user.id);

    return res.status(200).json(
      successResponse(content, 'Level published successfully'),
    );
  } catch (error) {
    return res.status(400).json(errorResponse(error.message || 'Failed to publish level content'));
  }
};

module.exports = {
  getLevelCatalog,
  getLevelContent,
  updateLevelDraft,
  publishLevel,
};
