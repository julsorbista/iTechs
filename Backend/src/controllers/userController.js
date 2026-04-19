const { 
  hashPassword,
  successResponse,
  errorResponse,
  sanitizeUser,
  getPaginationData,
  generateUsername
} = require('../utils/helpers');
const { sendWelcomeEmail, EMAIL_PURPOSES } = require('../utils/emailService');
const { initializeStudentProgression } = require('../services/progressionService');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const removeUserDependenciesForPermanentDelete = async (tx, user) => {
  await tx.score.deleteMany({
    where: { studentId: user.id }
  });

  if (user.role === 'TEACHER') {
    const createdExamIds = (user.createdExams || []).map(exam => exam.id);

    if (createdExamIds.length > 0) {
      await tx.score.deleteMany({
        where: {
          examId: {
            in: createdExamIds
          }
        }
      });

      await tx.exam.deleteMany({
        where: {
          id: {
            in: createdExamIds
          }
        }
      });
    }

    await tx.user.updateMany({
      where: { teacherId: user.id },
      data: { teacherId: null }
    });

    await tx.archivedUser.updateMany({
      where: { teacherId: user.id },
      data: { teacherId: null }
    });
  }
};

const COURSE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COURSE_CODE_LENGTH = 8;

const buildTeacherDisplayName = (teacher) => {
  if (!teacher) {
    return '';
  }

  const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
  return fullName || teacher.username || teacher.email || '';
};

const normalizeCourseCode = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
};

const generateCourseCodeCandidate = () => {
  let code = '';

  for (let index = 0; index < COURSE_CODE_LENGTH; index += 1) {
    code += COURSE_CODE_ALPHABET[crypto.randomInt(0, COURSE_CODE_ALPHABET.length)];
  }

  return code;
};

const generateUniqueTeacherCourseCode = async (tx, maxAttempts = 12) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateCourseCodeCandidate();
    const existing = await tx.user.findUnique({
      where: { courseCode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique course code.');
};

const ensureTeacherCourseCode = async (teacherId, tx = prisma) => {
  const teacher = await tx.user.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      role: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      courseCode: true,
      isArchived: true,
    },
  });

  if (!teacher || teacher.role !== 'TEACHER' || teacher.isArchived) {
    return null;
  }

  if (teacher.courseCode) {
    return teacher;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const nextCode = await generateUniqueTeacherCourseCode(tx);

    const result = await tx.user.updateMany({
      where: {
        id: teacher.id,
        role: 'TEACHER',
        isArchived: false,
        courseCode: null,
      },
      data: {
        courseCode: nextCode,
      },
    });

    if (result.count === 1) {
      return {
        ...teacher,
        courseCode: nextCode,
      };
    }

    const refreshedTeacher = await tx.user.findUnique({
      where: { id: teacher.id },
      select: {
        id: true,
        role: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        courseCode: true,
        isArchived: true,
      },
    });

    if (refreshedTeacher?.courseCode) {
      return refreshedTeacher;
    }
  }

  throw new Error('Unable to assign a course code to this teacher right now.');
};

const resetStudentProgressionForEnrollmentChange = async (studentId, tx) => {
  await tx.levelAttempt.deleteMany({
    where: { studentId },
  });

  await tx.gameSession.deleteMany({
    where: { studentId },
  });

  await tx.studentLevelState.deleteMany({
    where: { studentId },
  });

  await tx.teacherStudentPolicy.deleteMany({
    where: { studentId },
  });

  await initializeStudentProgression(studentId, tx);
};

// Get all users (with pagination and filtering)
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, search, isArchived } = req.query;
    
    const where = {};
    
    // Apply filters
    if (role) {
      where.role = role;
    }
    
    if (isArchived !== undefined) {
      where.isArchived = isArchived === 'true';
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ];
    }

    // For teachers, only show their students
    if (req.user.role === 'TEACHER') {
      where.OR = [
        { teacherId: req.user.id },
        { id: req.user.id } // Include self
      ];
    }

    // Get total count
    const totalCount = await prisma.user.count({ where });
    
    // Get pagination data
    const paginationData = getPaginationData(page, limit, totalCount);
    
    // Get users
    const users = await prisma.user.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            createdStudents: true,
            exams: true,
            scores: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: paginationData.offset,
      take: paginationData.limit
    });

    const sanitizedUsers = users.map(user => sanitizeUser(user));

    res.status(200).json(
      successResponse(
        {
          users: sanitizedUsers,
          ...paginationData.pagination
        },
        'Users retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Get user by ID
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        createdStudents: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            isArchived: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            exams: true,
            scores: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Check access permissions
    if (req.user.role === 'TEACHER') {
      // Teachers can only view their own profile or their students
      if (user.id !== req.user.id && user.teacherId !== req.user.id) {
        return res.status(403).json(
          errorResponse('Insufficient permissions')
        );
      }
    } else if (req.user.role === 'STUDENT') {
      // Students can only view their own profile
      if (user.id !== req.user.id) {
        return res.status(403).json(
          errorResponse('Insufficient permissions')
        );
      }
    }

    const sanitizedUser = sanitizeUser(user);

    res.status(200).json(
      successResponse(
        sanitizedUser,
        'User retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Create teacher/student (super admin only)
const createUser = async (req, res, next) => {
  try {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      section,
      username: providedUsername
    } = req.body;
    
    // Check permissions
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(
        errorResponse('Only super admins can create user accounts')
      );
    }

    // Determine username
    let username;
    if (providedUsername) {
      // Validate provided username format
      if (role === 'STUDENT' && !providedUsername.endsWith('@student.com')) {
        return res.status(400).json(
          errorResponse('Student username must end with @student.com')
        );
      }
      if (role === 'TEACHER' && !providedUsername.endsWith('@teacher.com')) {
        return res.status(400).json(
          errorResponse('Teacher username must end with @teacher.com')
        );
      }
      username = providedUsername;
    } else {
      // Generate username based on email and role if not provided
      username = generateUsername(email, role);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json(
        errorResponse('User with this username or email already exists')
      );
    }

    // Generate temporary password if not provided
    const userPassword = password || crypto.randomBytes(8).toString('hex') + 'A1!';
    const hashedPassword = await hashPassword(userPassword);

    const newUser = await prisma.$transaction(async (tx) => {
      const userData = {
        username,
        email,
        password: hashedPassword,
        role,
        firstName: firstName || null,
        lastName: lastName || null,
        section: role === 'STUDENT' ? String(section || '').trim() || null : null,
        isVerified: role === 'SUPER_ADMIN'
      };

      if (role === 'TEACHER') {
        userData.courseCode = await generateUniqueTeacherCourseCode(tx);
      }

      // For students, set the teacher relationship
      if (role === 'STUDENT' && req.user.role === 'TEACHER') {
        userData.teacherId = req.user.id;
      }

      const createdUser = await tx.user.create({
        data: userData
      });

      if (role === 'STUDENT') {
        await initializeStudentProgression(createdUser.id, tx);
      }

      return createdUser;
    });

    // Send the login username and created password to the new user's email.
    const isTemporaryPassword = !password;
    await sendWelcomeEmail({
      email,
      userName: firstName || email.split('@')[0],
      role,
      username,
      password: userPassword,
      isTemporaryPassword,
      purpose: EMAIL_PURPOSES.ACCOUNT_CREATED
    });

    const sanitizedUser = sanitizeUser(newUser);

    res.status(201).json(
      successResponse(
        {
          user: sanitizedUser,
          ...(isTemporaryPassword && { temporaryPassword: userPassword })
        },
        `${role.toLowerCase()} account created successfully`
      )
    );
  } catch (error) {
    next(error);
  }
};

// Update user
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, isArchived } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Check permissions
    if (req.user.role === 'TEACHER') {
      // Teachers can only update their students or their own profile
      if (user.id !== req.user.id && user.teacherId !== req.user.id) {
        return res.status(403).json(
          errorResponse('Insufficient permissions')
        );
      }
      
      // Teachers cannot change isArchived status
      if (isArchived !== undefined && user.id !== req.user.id) {
        return res.status(403).json(
          errorResponse('Teachers cannot archive/unarchive accounts')
        );
      }
    } else if (req.user.role === 'STUDENT') {
      // Students can only update their own profile
      if (user.id !== req.user.id) {
        return res.status(403).json(
          errorResponse('Insufficient permissions')
        );
      }
    }

    // Check if email already exists for another user
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id }
        }
      });

      if (existingUser) {
        return res.status(400).json(
          errorResponse('Email already in use by another account')
        );
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email && { email }),
        ...(isArchived !== undefined && 
            req.user.role === 'SUPER_ADMIN' && { isArchived })
      }
    });

    const sanitizedUser = sanitizeUser(updatedUser);

    res.status(200).json(
      successResponse(
        sanitizedUser,
        'User updated successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Archive user (move to archive table)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Find user with all related data
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        teacher: true,
        createdStudents: true,
        exams: true,
        scores: true,
        createdExams: true
      }
    });

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Check permissions
    if (req.user.role === 'TEACHER') {
      // Teachers can only archive their students
      if (user.teacherId !== req.user.id) {
        return res.status(403).json(
          errorResponse('Teachers can only archive their own students')
        );
      }
    } else if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(
        errorResponse('Insufficient permissions')
      );
    }

    // Prevent self-archiving
    if (user.id === req.user.id) {
      return res.status(400).json(
        errorResponse('Cannot archive your own account')
      );
    }

    // Start transaction to move user to archive table
    await prisma.$transaction(async (tx) => {
      // Create archived user record with complete data
      await tx.archivedUser.create({
        data: {
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          section: user.section,
          teacherId: user.teacherId,
          archivedBy: req.user.id,
          archiveReason: reason || 'No reason provided',
          userData: JSON.stringify({
            ...user,
            scores: undefined, // Don't duplicate relational data
            exams: undefined,
            createdExams: undefined,
            createdStudents: undefined,
            teacher: undefined
          })
        }
      });

      // Mark user as archived in main table (soft delete)
      await tx.user.update({
        where: { id },
        data: { isArchived: true }
      });
    });

    res.status(200).json(
      successResponse(
        null,
        'User archived successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Restore archived user
const restoreUser = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the userId of the archived user
    
    // Find archived user
    const archivedUser = await prisma.archivedUser.findUnique({
      where: { userId: id }
    });

    if (!archivedUser) {
      return res.status(404).json(
        errorResponse('Archived user not found')
      );
    }

    // Check permissions
    if (req.user.role === 'TEACHER') {
      // Teachers can only restore their students
      if (archivedUser.teacherId !== req.user.id) {
        return res.status(403).json(
          errorResponse('Teachers can only restore their own students')
        );
      }
    } else if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(
        errorResponse('Insufficient permissions')
      );
    }

    // Start transaction to restore user
    await prisma.$transaction(async (tx) => {
      // Update user to mark as active
      await tx.user.update({
        where: { id },
        data: { isArchived: false }
      });

      // Remove from archive table
      await tx.archivedUser.delete({
        where: { userId: id }
      });
    });

    res.status(200).json(
      successResponse(
        null,
        'User restored successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Permanently delete archived user
const permanentlyDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        createdExams: {
          select: {
            id: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    if (!user.isArchived) {
      return res.status(400).json(
        errorResponse('Only archived users can be permanently deleted')
      );
    }

    if (req.user.role === 'TEACHER') {
      if (user.role !== 'STUDENT' || user.teacherId !== req.user.id) {
        return res.status(403).json(
          errorResponse('Teachers can only permanently delete their own archived students')
        );
      }
    } else if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(
        errorResponse('Insufficient permissions')
      );
    }

    if (user.id === req.user.id) {
      return res.status(400).json(
        errorResponse('Cannot permanently delete your own account')
      );
    }

    await prisma.$transaction(async (tx) => {
      await removeUserDependenciesForPermanentDelete(tx, user);

      await tx.archivedUser.deleteMany({
        where: { userId: id }
      });

      await tx.user.delete({
        where: { id }
      });
    });

    res.status(200).json(
      successResponse(
        null,
        'User permanently deleted successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Get archived users
const getArchivedUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const where = {};
    
    // For teachers, only show their archived students
    if (req.user.role === 'TEACHER') {
      where.teacherId = req.user.id;
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.archivedUser.count({ where });
    
    // Get pagination data
    const paginationData = getPaginationData(page, limit, totalCount);
    
    // Get archived users
    const archivedUsers = await prisma.archivedUser.findMany({
      where,
      orderBy: { archivedAt: 'desc' },
      skip: paginationData.offset,
      take: paginationData.limit
    });

    res.status(200).json(
      successResponse(
        {
          archivedUsers,
          ...paginationData.pagination
        },
        'Archived users retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Get students for a teacher (active only by default)
const getMyStudents = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(
        errorResponse('Only teachers can view their students')
      );
    }

    const { page = 1, limit = 10, search, isArchived } = req.query;
    
    const where = {
      teacherId: req.user.id,
      isArchived: isArchived === 'true' ? true : false // Default to active students
    };
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.user.count({ where });
    
    // Get pagination data
    const paginationData = getPaginationData(page, limit, totalCount);
    
    // Get students
    const students = await prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            exams: true,
            scores: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: paginationData.offset,
      take: paginationData.limit
    });

    const sanitizedStudents = students.map(student => sanitizeUser(student));

    res.status(200).json(
      successResponse(
        {
          students: sanitizedStudents,
          ...paginationData.pagination
        },
        'Students retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

const getMyCourseCode = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(
        errorResponse('Only teachers can access course code settings')
      );
    }

    const teacher = await prisma.$transaction((tx) => ensureTeacherCourseCode(req.user.id, tx));
    if (!teacher) {
      return res.status(404).json(
        errorResponse('Teacher account not found')
      );
    }

    return res.status(200).json(
      successResponse(
        {
          courseCode: teacher.courseCode,
        },
        'Course code retrieved successfully'
      )
    );
  } catch (error) {
    return next(error);
  }
};

const getMyCourseEnrollment = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(
        errorResponse('Only students can access course enrollment settings')
      );
    }

    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        teacherId: true,
        teacher: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            courseCode: true,
            isArchived: true,
          },
        },
      },
    });

    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json(
        errorResponse('Student account not found')
      );
    }

    const teacher = student.teacher && !student.teacher.isArchived
      ? {
          id: student.teacher.id,
          username: student.teacher.username,
          firstName: student.teacher.firstName,
          lastName: student.teacher.lastName,
          displayName: buildTeacherDisplayName(student.teacher),
          courseCode: student.teacher.courseCode || null,
        }
      : null;

    return res.status(200).json(
      successResponse(
        {
          hasEnrollment: Boolean(teacher),
          teacher,
          courseCode: teacher?.courseCode || null,
        },
        'Course enrollment retrieved successfully'
      )
    );
  } catch (error) {
    return next(error);
  }
};

const enrollWithCourseCode = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(
        errorResponse('Only students can enroll with a course code')
      );
    }

    const normalizedCourseCode = normalizeCourseCode(req.body?.courseCode);
    if (!normalizedCourseCode) {
      return res.status(400).json(
        errorResponse('A valid course code is required')
      );
    }

    const confirmProgressReset = req.body?.confirmProgressReset === true;

    const [student, teacher] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          role: true,
          teacherId: true,
          isArchived: true,
        },
      }),
      prisma.user.findFirst({
        where: {
          role: 'TEACHER',
          isArchived: false,
          courseCode: normalizedCourseCode,
        },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          courseCode: true,
        },
      }),
    ]);

    if (!student || student.role !== 'STUDENT' || student.isArchived) {
      return res.status(404).json(
        errorResponse('Student account not found')
      );
    }

    if (!teacher) {
      return res.status(404).json(
        errorResponse('Course code was not found. Please check and try again.')
      );
    }

    if (student.teacherId === teacher.id) {
      return res.status(200).json(
        successResponse(
          {
            progressReset: false,
            teacher: {
              id: teacher.id,
              username: teacher.username,
              firstName: teacher.firstName,
              lastName: teacher.lastName,
              displayName: buildTeacherDisplayName(teacher),
              courseCode: teacher.courseCode,
            },
          },
          'You are already enrolled in this course.'
        )
      );
    }

    const replacingTeacher = Boolean(student.teacherId && student.teacherId !== teacher.id);
    if (replacingTeacher && !confirmProgressReset) {
      return res.status(409).json(
        errorResponse('Replacing your course code will remove all progress. Confirm reset to continue.')
      );
    }

    await prisma.$transaction(async (tx) => {
      if (replacingTeacher) {
        await resetStudentProgressionForEnrollmentChange(student.id, tx);
      }

      await tx.user.update({
        where: { id: student.id },
        data: { teacherId: teacher.id },
      });
    });

    return res.status(200).json(
      successResponse(
        {
          progressReset: replacingTeacher,
          teacher: {
            id: teacher.id,
            username: teacher.username,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            displayName: buildTeacherDisplayName(teacher),
            courseCode: teacher.courseCode,
          },
        },
        replacingTeacher
          ? 'Course code replaced and progress was reset successfully.'
          : 'Course code added successfully.'
      )
    );
  } catch (error) {
    return next(error);
  }
};

const removeCourseEnrollment = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(
        errorResponse('Only students can remove course enrollment')
      );
    }

    const confirmProgressReset = req.body?.confirmProgressReset === true;
    if (!confirmProgressReset) {
      return res.status(409).json(
        errorResponse('Removing your course code will remove all progress. Confirm reset to continue.')
      );
    }

    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        teacherId: true,
        isArchived: true,
      },
    });

    if (!student || student.role !== 'STUDENT' || student.isArchived) {
      return res.status(404).json(
        errorResponse('Student account not found')
      );
    }

    if (!student.teacherId) {
      return res.status(400).json(
        errorResponse('No course code is currently assigned to your account')
      );
    }

    await prisma.$transaction(async (tx) => {
      await resetStudentProgressionForEnrollmentChange(student.id, tx);

      await tx.user.update({
        where: { id: student.id },
        data: { teacherId: null },
      });
    });

    return res.status(200).json(
      successResponse(
        {
          progressReset: true,
          teacher: null,
        },
        'Course code removed and progress was reset successfully.'
      )
    );
  } catch (error) {
    return next(error);
  }
};

// Reset user password (generate new temporary password)
const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Check permissions
    if (req.user.role === 'TEACHER' && user.teacherId !== req.user.id) {
      return res.status(403).json(
        errorResponse('Teachers can only reset passwords for their students')
      );
    } else if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'TEACHER') {
      return res.status(403).json(
        errorResponse('Insufficient permissions')
      );
    }

    // Generate new temporary password
    const temporaryPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
    const hashedPassword = await hashPassword(temporaryPassword);

    // Update user password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    // Send email with new password
    await sendWelcomeEmail({
      email: user.email,
      userName: user.firstName || user.username,
      role: user.role,
      username: user.username,
      password: temporaryPassword,
      isTemporaryPassword: true,
      purpose: EMAIL_PURPOSES.PASSWORD_RESET
    });

    res.status(200).json(
      successResponse(
        { temporaryPassword },
        'Password reset successfully. New temporary password sent to user email.'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
