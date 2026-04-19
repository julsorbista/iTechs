const express = require('express');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
  permanentlyDeleteUser,
  getArchivedUsers,
  getMyStudents,
  getMyCourseCode,
  getMyCourseEnrollment,
  enrollWithCourseCode,
  removeCourseEnrollment,
  resetUserPassword
} = require('../controllers/userController');
const {
  getMyStudentsRoster,
  getStudentProgressDetail,
  getRosterLeaderboard,
  upsertStudentPolicy,
  requestContentRegeneration,
  getMyContentFlags,
  getTeacherLevelCanvas,
  saveTeacherLevelCanvas,
} = require('../controllers/teacherController');
const {
  registerValidation,
  idValidation,
  paginationValidation,
  teacherStudentIdValidation,
  teacherPolicyValidation,
  contentFlagValidation,
  courseCodeEnrollmentValidation,
  courseCodeResetValidation,
  gameLevelNumberValidation,
  teacherLevelCanvasValidation,
} = require('../middleware/validation');
const { 
  authenticateToken, 
  requireTeacher,
  requireTeacherOnly,
  requireStudentOnly,
} = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Private (Super Admin sees all, Teachers see their students, Students see only themselves)
 */
router.get('/', paginationValidation(), getUsers);

/**
 * @route   GET /api/users/my-students
 * @desc    Get students created by the authenticated teacher
 * @access  Private (Teachers only)
 */
router.get('/my-students', requireTeacher, paginationValidation(), getMyStudents);

/**
 * @route   GET /api/users/me/course-code
 * @desc    Get or initialize the authenticated teacher's unique course code
 * @access  Private (Teachers only)
 */
router.get('/me/course-code', requireTeacherOnly, getMyCourseCode);

/**
 * @route   GET /api/users/me/course-enrollment
 * @desc    Get the authenticated student's current course enrollment
 * @access  Private (Students only)
 */
router.get('/me/course-enrollment', requireStudentOnly, getMyCourseEnrollment);

/**
 * @route   POST /api/users/me/course-enrollment
 * @desc    Enroll or replace course enrollment using a teacher course code
 * @access  Private (Students only)
 */
router.post('/me/course-enrollment', requireStudentOnly, courseCodeEnrollmentValidation(), enrollWithCourseCode);

/**
 * @route   DELETE /api/users/me/course-enrollment
 * @desc    Remove current course enrollment (destructive reset)
 * @access  Private (Students only)
 */
router.delete('/me/course-enrollment', requireStudentOnly, courseCodeResetValidation(), removeCourseEnrollment);

/**
 * @route   GET /api/users/my-students/roster
 * @desc    Get teacher roster with progression metrics
 * @access  Private (Teachers only)
 */
router.get('/my-students/roster', requireTeacher, paginationValidation(), getMyStudentsRoster);

/**
 * @route   GET /api/users/my-students/leaderboard
 * @desc    Get leaderboard for teacher assigned roster
 * @access  Private (Teachers only)
 */
router.get('/my-students/leaderboard', requireTeacher, getRosterLeaderboard);

/**
 * @route   GET /api/users/my-students/flags
 * @desc    Get teacher content flags / regeneration requests
 * @access  Private (Teachers only)
 */
router.get('/my-students/flags', requireTeacher, getMyContentFlags);

/**
 * @route   GET /api/users/me/level-editor/levels/:levelNumber
 * @desc    Get teacher-owned level editor canvas payload for one level
 * @access  Private (Teachers only)
 */
router.get('/me/level-editor/levels/:levelNumber', requireTeacherOnly, gameLevelNumberValidation(), getTeacherLevelCanvas);

/**
 * @route   PUT /api/users/me/level-editor/levels/:levelNumber
 * @desc    Save teacher-owned level editor canvas payload for one level
 * @access  Private (Teachers only)
 */
router.put('/me/level-editor/levels/:levelNumber', requireTeacherOnly, gameLevelNumberValidation(), teacherLevelCanvasValidation(), saveTeacherLevelCanvas);

/**
 * @route   GET /api/users/my-students/:studentId/progress
 * @desc    Get student detail progression (levels + attempt timeline)
 * @access  Private (Teachers only)
 */
router.get('/my-students/:studentId/progress', requireTeacher, teacherStudentIdValidation(), getStudentProgressDetail);

/**
 * @route   PATCH /api/users/my-students/:studentId/policy
 * @desc    Upsert teacher policy knobs for a student
 * @access  Private (Teachers only)
 */
router.patch('/my-students/:studentId/policy', requireTeacher, teacherStudentIdValidation(), teacherPolicyValidation(), upsertStudentPolicy);

/**
 * @route   POST /api/users/my-students/:studentId/flags
 * @desc    Request content regeneration for a student level
 * @access  Private (Teachers only)
 */
router.post('/my-students/:studentId/flags', requireTeacher, teacherStudentIdValidation(), contentFlagValidation(), requestContentRegeneration);

/**
 * @route   GET /api/users/archived
 * @desc    Get archived users
 * @access  Private (Super Admin sees all, Teachers see their archived students)
 */
router.get('/archived', paginationValidation(), getArchivedUsers);

/**
 * @route   POST /api/users/:id/restore
 * @desc    Restore archived user
 * @access  Private (Super Admin or Teachers for their students)
 */
router.post('/:id/restore', idValidation(), restoreUser);

/**
 * @route   DELETE /api/users/:id/permanent
 * @desc    Permanently delete archived user
 * @access  Private (Super Admin or Teachers for their archived students)
 */
router.delete('/:id/permanent', idValidation(), permanentlyDeleteUser);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Role-based access control)
 */
router.get('/:id', idValidation(), getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user (Super Admin creates Teachers and Students)
 * @access  Private (Super Admin only)
 */
router.post('/', registerValidation(), createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID
 * @access  Private (Role-based access control)
 */
router.put('/:id', idValidation(), updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate user by ID
 * @access  Private (Super Admin or Teachers for their students)
 */
router.delete('/:id', idValidation(), deleteUser);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user password (generate new temporary password)
 * @access  Private (Super Admin or Teachers for their students)
 */
router.post('/:id/reset-password', idValidation(), resetUserPassword);

module.exports = router;
