const express = require('express');
const {
  getExams,
  getExamById,
  getExamByCode,
  createExam,
  updateExam,
  deleteExam,
  joinExam,
  getExamStatistics
} = require('../controllers/examController');
const {
  examValidation,
  idValidation,
  paginationValidation
} = require('../middleware/validation');
const { 
  authenticateToken, 
  requireTeacher,
  requireStudent,
  optionalAuth
} = require('../middleware/auth');

const router = express.Router();

// Public routes (with optional authentication for user context)

/**
 * @route   GET /api/exams/code/:examCode
 * @desc    Get exam details by exam code (for preview before joining)
 * @access  Public
 */
router.get('/code/:examCode', optionalAuth, getExamByCode);

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/exams
 * @desc    Get all exams with pagination and filtering
 * @access  Private (Teachers see their exams, Students see their enrolled exams)
 */
router.get('/', paginationValidation(), getExams);

/**
 * @route   GET /api/exams/:id
 * @desc    Get exam by ID
 * @access  Private (Role-based access control)
 */
router.get('/:id', idValidation(), getExamById);

/**
 * @route   GET /api/exams/:id/statistics
 * @desc    Get exam statistics and scores
 * @access  Private (Teachers and Super Admin only)
 */
router.get('/:id/statistics', requireTeacher, idValidation(), getExamStatistics);

/**
 * @route   POST /api/exams
 * @desc    Create new exam
 * @access  Private (Teachers only)
 */
router.post('/', requireTeacher, examValidation(), createExam);

/**
 * @route   POST /api/exams/join
 * @desc    Join exam using exam code
 * @access  Private (Students only)
 */
router.post('/join', requireStudent, joinExam);

/**
 * @route   PUT /api/exams/:id
 * @desc    Update exam by ID
 * @access  Private (Teachers for their own exams, Super Admin for all)
 */
router.put('/:id', idValidation(), updateExam);

/**
 * @route   DELETE /api/exams/:id
 * @desc    Delete exam by ID
 * @access  Private (Teachers for their own exams, Super Admin for all)
 */
router.delete('/:id', idValidation(), deleteExam);

module.exports = router;