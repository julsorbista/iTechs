const express = require('express');
const {
  register,
  login,
  verifyOTP,
  requestOTP,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  refreshToken
} = require('../controllers/authController');
const {
  registerValidation,
  loginValidation,
  otpValidation,
  requestOtpValidation,
  changePasswordValidation,
  updateProfileValidation
} = require('../middleware/validation');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Public routes

/**
 * @route   POST /api/auth/login
 * @desc    Login user (with OTP for teachers)
 * @access  Public
 */
router.post('/login', loginValidation(), login);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP for teacher login
 * @access  Public
 */
router.post('/verify-otp', otpValidation(), verifyOTP);

/**
 * @route   POST /api/auth/request-otp
 * @desc    Request OTP for password reset or re-authentication
 * @access  Public
 */
router.post('/request-otp', requestOtpValidation(), requestOTP);

// Protected routes

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (Super Admin creates Teachers and Students)
 * @access  Private (Super Admin only)
 */
router.post('/register', authenticateToken, requireSuperAdmin, registerValidation(), register);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, updateProfileValidation(), updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticateToken, changePasswordValidation(), changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, logout);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh-token', authenticateToken, refreshToken);

module.exports = router;
