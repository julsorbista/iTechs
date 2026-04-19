const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// JWT utility functions
const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE_TIME || '7d',
      issuer: 'iTECHS-Learning-Platform',
      audience: 'iTECHS-Users'
    }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Password utility functions
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// OTP utility functions
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOTP = (otpCode) => {
  return crypto.createHash('sha256').update(String(otpCode)).digest('hex');
};

const generateOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

// Username utility functions
const generateUsername = (email, role) => {
  const baseEmail = email.split('@')[0];
  
  switch (role) {
    case 'STUDENT':
      return `${baseEmail}@student.com`;
    case 'TEACHER':
      return `${baseEmail}@teacher.com`;
    case 'SUPER_ADMIN':
      return email; // Super admin keeps original email
    default:
      throw new Error('Invalid role specified');
  }
};

const extractUsernameBase = (username) => {
  if (username.includes('@student.com')) {
    return username.replace('@student.com', '');
  } else if (username.includes('@teacher.com')) {
    return username.replace('@teacher.com', '');
  } else {
    return username.split('@')[0];
  }
};

const getRoleFromUsername = (username) => {
  if (username.endsWith('@student.com')) {
    return 'STUDENT';
  } else if (username.endsWith('@teacher.com')) {
    return 'TEACHER';
  } else {
    return 'SUPER_ADMIN';
  }
};

// Exam code utility functions
const generateExamCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Response utility functions
const successResponse = (data = null, message = 'Success', statusCode = 200) => {
  const response = {
    status: 'success',
    message
  };
  
  if (data) {
    response.data = data;
  }
  
  return response;
};

const errorResponse = (message = 'Error', statusCode = 500, details = null) => {
  const response = {
    status: 'error',
    message
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  return response;
};

// Pagination utility
const getPaginationData = (page = 1, limit = 10, total = 0) => {
  const currentPage = parseInt(page);
  const pageSize = parseInt(limit);
  const totalPages = Math.ceil(total / pageSize);
  const offset = (currentPage - 1) * pageSize;
  
  return {
    pagination: {
      currentPage,
      pageSize,
      totalPages,
      totalRecords: total,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    },
    offset,
    limit: pageSize
  };
};

// Sanitize user data for response
const sanitizeUser = (user) => {
  if (!user) return null;
  
  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.otpCode;
  delete sanitized.otpExpiry;
  
  return sanitized;
};

// Format exam code for display
const formatExamCode = (code) => {
  return code.toUpperCase().replace(/(.{3})/g, '$1-').slice(0, -1);
};

module.exports = {
  // JWT
  generateToken,
  verifyToken,
  
  // Password
  hashPassword,
  comparePassword,
  
  // OTP
  generateOTP,
  hashOTP,
  generateOTPExpiry,
  
  // Username
  generateUsername,
  extractUsernameBase,
  getRoleFromUsername,
  
  // Exam
  generateExamCode,
  formatExamCode,
  
  // Response
  successResponse,
  errorResponse,
  
  // Pagination
  getPaginationData,
  
  // Sanitization
  sanitizeUser
};