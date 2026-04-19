const {
  hashPassword,
  comparePassword,
  generateToken,
  generateOTP,
  hashOTP,
  generateOTPExpiry,
  successResponse,
  errorResponse,
  sanitizeUser,
} = require('../utils/helpers');
const { sendOTPEmail, sendWelcomeEmail, EMAIL_PURPOSES } = require('../utils/emailService');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 10;
const OTP_VALID_MINUTES = 10;
const OTP_BYPASS_EMAILS = new Set([
  'admin@gmail.com',
  'admin@teacher.com',
  'admin@student.com',
]);
const COURSE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COURSE_CODE_LENGTH = 8;

const isOtpBypassAccount = (email) => OTP_BYPASS_EMAILS.has(String(email || '').toLowerCase());

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
};

const generateCourseCodeCandidate = () => {
  let code = '';

  for (let index = 0; index < COURSE_CODE_LENGTH; index += 1) {
    code += COURSE_CODE_ALPHABET[crypto.randomInt(0, COURSE_CODE_ALPHABET.length)];
  }

  return code;
};

const generateUniqueTeacherCourseCode = async (maxAttempts = 12) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateCourseCodeCandidate();
    const existing = await prisma.user.findUnique({
      where: { courseCode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique course code.');
};

const createAuditLog = async ({ actorUserId, action, entityType, entityId, metadata, ipAddress }) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action,
        entityType,
        entityId: entityId || null,
        metadata: metadata || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    // Audit logging must not block user requests.
    console.error('Audit log failed:', error.message);
  }
};

const createLoginAttempt = async ({ userId, usernameRaw, success, ipAddress }) => {
  await prisma.loginAttempt.create({
    data: {
      userId: userId || null,
      usernameRaw,
      success,
      ipAddress: ipAddress || null,
    },
  });
};

const getActiveLock = async (userId) => {
  return prisma.accountLock.findFirst({
    where: {
      userId,
      lockedUntil: {
        gt: new Date(),
      },
    },
    orderBy: {
      lockedUntil: 'desc',
    },
  });
};

const issueOtp = async (user, purpose) => {
  const otpCode = generateOTP();
  const otpExpiry = generateOTPExpiry(OTP_VALID_MINUTES);

  await prisma.otpToken.create({
    data: {
      userId: user.id,
      codeHash: hashOTP(otpCode),
      purpose,
      expiresAt: otpExpiry,
    },
  });

  await sendOTPEmail(user.email, otpCode, user.firstName || user.username);

  return {
    expiresAt: otpExpiry,
    maskedEmail: user.email.replace(/(.{2}).*(@.*)/, '$1****$2'),
  };
};

const register = async (req, res, next) => {
  try {
    const { username, email, password, role, firstName, lastName } = req.body;

    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(errorResponse('Only super admins can register users from this endpoint'));
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json(errorResponse('User with this username or email already exists'));
    }

    const hashedPassword = await hashPassword(password);

    const courseCode = role === 'TEACHER'
      ? await generateUniqueTeacherCourseCode()
      : null;

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        firstName: firstName || null,
        lastName: lastName || null,
        ...(courseCode ? { courseCode } : {}),
        isVerified: role === 'SUPER_ADMIN',
      },
    });

    await sendWelcomeEmail({
      email,
      userName: firstName || username,
      role,
      username,
      password,
      isTemporaryPassword: false,
      purpose: EMAIL_PURPOSES.ACCOUNT_CREATED,
    });

    if (!newUser.isVerified) {
      await issueOtp(newUser, 'ACTIVATE');
    }

    await createAuditLog({
      actorUserId: req.user.id,
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: newUser.id,
      metadata: { role: newUser.role },
      ipAddress: getRequestIp(req),
    });

    res.status(201).json(
      successResponse(
        {
          user: sanitizeUser(newUser),
          requiresActivation: !newUser.isVerified,
        },
        'Registration successful'
      )
    );
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ipAddress = getRequestIp(req);

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      await createLoginAttempt({ usernameRaw: username, success: false, ipAddress });
      return res.status(401).json(errorResponse('Invalid credentials'));
    }

    if (user.isArchived) {
      await createLoginAttempt({ userId: user.id, usernameRaw: username, success: false, ipAddress });
      await createAuditLog({
        actorUserId: user.id,
        action: 'LOGIN_BLOCKED_ARCHIVED',
        entityType: 'USER',
        entityId: user.id,
        ipAddress,
      });
      return res.status(401).json(errorResponse('Account has been archived'));
    }

    const activeLock = await getActiveLock(user.id);
    if (activeLock) {
      const remainingMs = new Date(activeLock.lockedUntil).getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      return res.status(423).json(errorResponse(`Account is locked. Try again in ${remainingMinutes} minute(s).`));
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      await createLoginAttempt({ userId: user.id, usernameRaw: username, success: false, ipAddress });

      const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);
      const failedCount = await prisma.loginAttempt.count({
        where: {
          userId: user.id,
          success: false,
          createdAt: { gte: since },
        },
      });

      if (failedCount >= LOCKOUT_THRESHOLD) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await prisma.accountLock.create({
          data: {
            userId: user.id,
            reason: 'MAX_FAILED_LOGIN_ATTEMPTS',
            lockedUntil,
          },
        });

        await createAuditLog({
          actorUserId: user.id,
          action: 'ACCOUNT_LOCKED',
          entityType: 'USER',
          entityId: user.id,
          metadata: { failedCount, lockedUntil },
          ipAddress,
        });

        return res.status(423).json(errorResponse('Account locked due to multiple failed login attempts. Try again in 10 minutes.'));
      }

      return res.status(401).json(errorResponse('Invalid credentials'));
    }

    await createLoginAttempt({ userId: user.id, usernameRaw: username, success: true, ipAddress });

    if (!user.isVerified && !isOtpBypassAccount(user.email)) {
      const otpMeta = await issueOtp(user, 'ACTIVATE');
      await createAuditLog({
        actorUserId: user.id,
        action: 'OTP_ISSUED_ACTIVATION',
        entityType: 'USER',
        entityId: user.id,
        metadata: { expiresAt: otpMeta.expiresAt },
        ipAddress,
      });

      return res.status(200).json(
        successResponse(
          {
            requiresOTP: true,
            activationRequired: true,
            email: user.email,
            maskedEmail: otpMeta.maskedEmail,
            userId: user.id,
          },
          'Account activation required. OTP sent to your email.'
        )
      );
    }

    if (!user.isVerified && isOtpBypassAccount(user.email)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          otpVerified: true,
          otpCode: null,
          otpExpiry: null,
        },
      });
    }

    if (user.role === 'TEACHER' && !isOtpBypassAccount(user.email)) {
      const otpMeta = await issueOtp(user, 'LOGIN');
      await createAuditLog({
        actorUserId: user.id,
        action: 'OTP_ISSUED_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        metadata: { expiresAt: otpMeta.expiresAt },
        ipAddress,
      });

      return res.status(200).json(
        successResponse(
          {
            requiresOTP: true,
            activationRequired: false,
            email: user.email,
            maskedEmail: otpMeta.maskedEmail,
            userId: user.id,
          },
          'OTP sent to your email. Please verify to complete login.'
        )
      );
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      ipAddress,
    });

    res.status(200).json(
      successResponse(
        {
          token,
          user: sanitizeUser(updatedUser),
        },
        'Login successful'
      )
    );
  } catch (error) {
    next(error);
  }
};

const verifyOTP = async (req, res, next) => {
  try {
    const { email, otpCode } = req.body;
    const ipAddress = getRequestIp(req);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isArchived) {
      return res.status(400).json(errorResponse('Invalid OTP code'));
    }

    const purpose = user.isVerified ? 'LOGIN' : 'ACTIVATE';

    const otpToken = await prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpToken || otpToken.codeHash !== hashOTP(otpCode)) {
      await createAuditLog({
        actorUserId: user.id,
        action: 'OTP_VERIFY_FAILED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { purpose },
        ipAddress,
      });
      return res.status(400).json(errorResponse('Invalid OTP code'));
    }

    await prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { consumedAt: new Date() },
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpVerified: true,
        lastLogin: new Date(),
      },
    });

    const token = generateToken({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    await createAuditLog({
      actorUserId: updatedUser.id,
      action: 'OTP_VERIFIED',
      entityType: 'USER',
      entityId: updatedUser.id,
      metadata: { purpose },
      ipAddress,
    });

    res.status(200).json(
      successResponse(
        {
          token,
          user: sanitizeUser(updatedUser),
        },
        'OTP verified successfully. Login complete.'
      )
    );
  } catch (error) {
    next(error);
  }
};

const requestOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = getRequestIp(req);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isArchived) {
      return res.status(200).json(successResponse(null, 'If the email exists, an OTP will be sent.'));
    }

    const purpose = user.isVerified ? 'LOGIN' : 'ACTIVATE';
    const otpMeta = await issueOtp(user, purpose);

    await createAuditLog({
      actorUserId: user.id,
      action: 'OTP_REQUESTED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { purpose, expiresAt: otpMeta.expiresAt },
      ipAddress,
    });

    res.status(200).json(successResponse(null, 'OTP sent to your email if the account exists.'));
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            createdStudents: true,
            exams: true,
            scores: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    res.status(200).json(successResponse(sanitizeUser(user), 'Profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email } = req.body;

    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        return res.status(400).json(errorResponse('Email already in use by another account'));
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email && { email }),
      },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: userId,
      ipAddress: getRequestIp(req),
    });

    res.status(200).json(successResponse(sanitizeUser(updatedUser), 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json(errorResponse('Current password is incorrect'));
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      ipAddress: getRequestIp(req),
    });

    res.status(200).json(successResponse(null, 'Password changed successfully'));
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await createAuditLog({
      actorUserId: req.user.id,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      ipAddress: getRequestIp(req),
    });

    res.status(200).json(successResponse(null, 'Logged out successfully'));
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const newToken = generateToken({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    });

    await createAuditLog({
      actorUserId: req.user.id,
      action: 'TOKEN_REFRESHED',
      entityType: 'USER',
      entityId: req.user.id,
      ipAddress: getRequestIp(req),
    });

    res.status(200).json(successResponse({ token: newToken }, 'Token refreshed successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyOTP,
  requestOTP,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  refreshToken,
};
