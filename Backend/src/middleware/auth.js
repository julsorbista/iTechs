const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are not archived
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        teacherId: true,
        firstName: true,
        lastName: true,
        isArchived: true,
        isVerified: true
      }
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token - user not found'
      });
    }

    if (user.isArchived) {
      return res.status(401).json({
        status: 'error',
        message: 'Account has been archived'
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is not activated. Please verify OTP first.'
      });
    }

    req.user = user;
    req.authSessionKey = Number.isInteger(decoded?.iat) ? String(decoded.iat) : '';
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Token verification failed'
    });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const normalizedRole = req.user.role === 'ADMIN' ? 'SUPER_ADMIN' : req.user.role;
    const normalizedAllowedRoles = roles.map((role) => (role === 'ADMIN' ? 'SUPER_ADMIN' : role));

    if (!normalizedAllowedRoles.includes(normalizedRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check if user is super admin
const requireSuperAdmin = authorize('SUPER_ADMIN');

// Check if user is teacher or super admin
const requireTeacher = authorize('TEACHER', 'SUPER_ADMIN');

// Check if user is teacher only
const requireTeacherOnly = authorize('TEACHER');

// Check if user is student (or higher)
const requireStudent = authorize('STUDENT', 'TEACHER', 'SUPER_ADMIN');

// Check if user is student only
const requireStudentOnly = authorize('STUDENT');

// Optional authentication (for public routes that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        teacherId: true,
        firstName: true,
        lastName: true,
        isArchived: true,
        isVerified: true
      }
    });

    req.user = user && !user.isArchived ? user : null;
    req.authSessionKey = Number.isInteger(decoded?.iat) ? String(decoded.iat) : '';
    next();
  } catch (error) {
    req.user = null;
    req.authSessionKey = '';
    next();
  }
};

module.exports = {
  authenticateToken,
  authorize,
  requireSuperAdmin,
  requireTeacher,
  requireTeacherOnly,
  requireStudent,
  requireStudentOnly,
  optionalAuth
};
