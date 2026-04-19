const { successResponse, errorResponse } = require('../utils/helpers');
const { generateQuestionWithGemini } = require('../services/aiQuestionService');

const ALLOWED_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

const generateAiQuestion = async (req, res, next) => {
  try {
    const {
      topic,
      difficulty = 'medium',
      gradeLevel = '',
      questionType = 'multiple-choice',
      language = 'English',
      instructions = '',
      choicesCount = 4,
      questionCount = 5,
    } = req.body || {};

    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json(errorResponse('Topic is required.'));
    }

    const normalizedDifficulty = String(difficulty || 'medium').trim().toLowerCase();
    if (!ALLOWED_DIFFICULTIES.has(normalizedDifficulty)) {
      return res.status(400).json(errorResponse('Difficulty must be one of: easy, medium, hard.'));
    }

    const normalizedChoicesCount = Number.parseInt(choicesCount, 10);
    if (!Number.isInteger(normalizedChoicesCount) || normalizedChoicesCount < 2 || normalizedChoicesCount > 6) {
      return res.status(400).json(errorResponse('choicesCount must be an integer between 2 and 6.'));
    }

    const normalizedQuestionCount = Number.parseInt(questionCount, 10);
    if (!Number.isInteger(normalizedQuestionCount) || normalizedQuestionCount < 5 || normalizedQuestionCount > 10) {
      return res.status(400).json(errorResponse('questionCount must be an integer between 5 and 10.'));
    }

    if (typeof instructions !== 'string') {
      return res.status(400).json(errorResponse('instructions must be a string when provided.'));
    }

    if (instructions.length > 1000) {
      return res.status(400).json(errorResponse('instructions cannot exceed 1000 characters.'));
    }

    const payload = await generateQuestionWithGemini({
      topic: topic.trim(),
      difficulty: normalizedDifficulty,
      gradeLevel: typeof gradeLevel === 'string' ? gradeLevel.trim() : '',
      questionType: typeof questionType === 'string' && questionType.trim()
        ? questionType.trim()
        : 'multiple-choice',
      language: typeof language === 'string' && language.trim() ? language.trim() : 'English',
      instructions: instructions.trim(),
      choicesCount: normalizedChoicesCount,
      questionCount: normalizedQuestionCount,
    });

    return res.status(200).json(
      successResponse(payload, 'AI questions generated successfully.'),
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  generateAiQuestion,
};
