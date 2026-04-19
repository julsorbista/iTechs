const { successResponse, errorResponse, getPaginationData, sanitizeUser } = require('../utils/helpers');
const { GAME_ORDER_INDEX } = require('../config/gameCatalog');
const prisma = require('../lib/prisma');
const {
  getTeacherLevelCanvas: getTeacherLevelCanvasData,
  saveTeacherLevelCanvas: saveTeacherLevelCanvasData,
} = require('../services/teacherLevelEditorService');

const ensureTeacherOwnsStudent = async (teacherId, studentId) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      role: true,
      teacherId: true,
      section: true,
      firstName: true,
      lastName: true,
      username: true,
      isArchived: true
    }
  });

  if (!student || student.role !== 'STUDENT') {
    return { ok: false, status: 404, message: 'Student not found' };
  }

  if (student.isArchived) {
    return { ok: false, status: 400, message: 'Student account is archived' };
  }

  if (student.teacherId !== teacherId) {
    return { ok: false, status: 403, message: 'You can only access assigned students' };
  }

  return { ok: true, student };
};

const getMyStudentsRoster = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can view roster data'));
    }

    const { page = 1, limit = 10, search, isArchived } = req.query;

    const where = {
      teacherId: req.user.id,
      role: 'STUDENT',
      isArchived: isArchived === 'true'
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { section: { contains: search, mode: 'insensitive' } }
      ];
    }

    const totalCount = await prisma.user.count({ where });
    const pagination = getPaginationData(page, limit, totalCount);

    const students = await prisma.user.findMany({
      where,
      include: {
        levelStates: {
          select: {
            status: true,
            bestStars: true,
            bestScore: true,
            completedAt: true
          }
        },
        levelAttempts: {
          select: {
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit
    });

    const roster = students.map((student) => {
      const completedLevels = student.levelStates.filter((item) => item.status === 'COMPLETED').length;
      const totalStars = student.levelStates.reduce((sum, item) => sum + (item.bestStars || 0), 0);
      const totalScore = student.levelStates.reduce((sum, item) => sum + (item.bestScore || 0), 0);
      const lastAttemptAt = student.levelAttempts[0]?.createdAt || null;
      const totalLevels = Math.max(student.levelStates.length, 1);

      return {
        ...sanitizeUser(student),
        metrics: {
          completedLevels,
          totalLevels,
          totalStars,
          totalScore,
          progressPercent: Number(((completedLevels / totalLevels) * 100).toFixed(2)),
          lastAttemptAt
        }
      };
    });

    return res.status(200).json(successResponse({ students: roster, ...pagination.pagination }, 'Roster retrieved successfully'));
  } catch (error) {
    return next(error);
  }
};

const getStudentProgressDetail = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can view student progression detail'));
    }

    const { studentId } = req.params;
    const ownership = await ensureTeacherOwnsStudent(req.user.id, studentId);

    if (!ownership.ok) {
      return res.status(ownership.status).json(errorResponse(ownership.message));
    }

    const [levels, attempts, policy] = await Promise.all([
      prisma.studentLevelState.findMany({
        where: { studentId },
        include: {
          level: {
            select: {
              levelNumber: true,
              gameType: true,
              gameLevelNumber: true,
              title: true
            }
          }
        }
      }),
      prisma.levelAttempt.findMany({
        where: { studentId },
        include: {
          level: {
            select: {
              levelNumber: true,
              gameType: true,
              gameLevelNumber: true,
              title: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.teacherStudentPolicy.findUnique({
        where: {
          teacherId_studentId: {
            teacherId: req.user.id,
            studentId
          }
        }
      })
    ]);

    const orderedLevels = [...levels].sort((left, right) => {
      const leftGameIndex = GAME_ORDER_INDEX[left.level.gameType] ?? 999;
      const rightGameIndex = GAME_ORDER_INDEX[right.level.gameType] ?? 999;

      if (leftGameIndex !== rightGameIndex) {
        return leftGameIndex - rightGameIndex;
      }

      return left.level.gameLevelNumber - right.level.gameLevelNumber;
    });

    const levelProgress = orderedLevels.map((state) => ({
      legacyLevelNumber: state.level.levelNumber,
      levelNumber: state.level.gameLevelNumber,
      gameType: state.level.gameType,
      title: state.level.title,
      status: state.status,
      attemptsCount: state.attemptsCount,
      bestStars: state.bestStars,
      bestScore: state.bestScore,
      unlockedAt: state.unlockedAt,
      completedAt: state.completedAt
    }));

    const timeline = attempts.map((attempt) => ({
      id: attempt.id,
      legacyLevelNumber: attempt.level.levelNumber,
      levelNumber: attempt.level.gameLevelNumber,
      gameType: attempt.level.gameType,
      levelTitle: attempt.level.title,
      completed: attempt.completed,
      starsEarned: attempt.starsEarned,
      finalScore: attempt.finalScore,
      mistakes: attempt.mistakes,
      hintsUsed: attempt.hintsUsed,
      createdAt: attempt.createdAt,
      completedAt: attempt.completedAt
    }));

    const summary = {
      totalLevels: levelProgress.length,
      totalLevelsCompleted: levelProgress.filter((row) => row.status === 'COMPLETED').length,
      totalStars: levelProgress.reduce((sum, row) => sum + row.bestStars, 0),
      totalScore: levelProgress.reduce((sum, row) => sum + row.bestScore, 0),
      totalAttempts: timeline.length
    };

    return res.status(200).json(
      successResponse(
        {
          student: ownership.student,
          summary,
          levelProgress,
          timeline,
          policy: policy || {
            difficultyPreset: 'STANDARD',
            freeMistakes: 3,
            hintStarCost: 1,
            notes: null
          }
        },
        'Student progression detail retrieved successfully'
      )
    );
  } catch (error) {
    return next(error);
  }
};

const getRosterLeaderboard = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can view roster leaderboard'));
    }

    const students = await prisma.user.findMany({
      where: {
        teacherId: req.user.id,
        role: 'STUDENT',
        isArchived: false
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        section: true,
        levelStates: {
          select: {
            status: true,
            bestStars: true,
            bestScore: true
          }
        }
      }
    });

    const leaderboard = students
      .map((student) => {
        const completedLevels = student.levelStates.filter((item) => item.status === 'COMPLETED').length;
        const totalStars = student.levelStates.reduce((sum, item) => sum + item.bestStars, 0);
        const totalScore = student.levelStates.reduce((sum, item) => sum + item.bestScore, 0);
        const totalLevels = Math.max(student.levelStates.length, 1);

        return {
          studentId: student.id,
          studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username,
          username: student.username,
          section: student.section || null,
          completedLevels,
          totalLevels,
          totalStars,
          totalScore,
          progressPercent: Number(((completedLevels / totalLevels) * 100).toFixed(2))
        };
      })
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
        return b.completedLevels - a.completedLevels;
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return res.status(200).json(successResponse({ leaderboard }, 'Roster leaderboard retrieved successfully'));
  } catch (error) {
    return next(error);
  }
};

const upsertStudentPolicy = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can update student policies'));
    }

    const { studentId } = req.params;
    const ownership = await ensureTeacherOwnsStudent(req.user.id, studentId);

    if (!ownership.ok) {
      return res.status(ownership.status).json(errorResponse(ownership.message));
    }

    const {
      difficultyPreset = 'STANDARD',
      freeMistakes = 3,
      hintStarCost = 1,
      notes = null
    } = req.body;

    const policy = await prisma.teacherStudentPolicy.upsert({
      where: {
        teacherId_studentId: {
          teacherId: req.user.id,
          studentId
        }
      },
      create: {
        teacherId: req.user.id,
        studentId,
        difficultyPreset,
        freeMistakes,
        hintStarCost,
        notes
      },
      update: {
        difficultyPreset,
        freeMistakes,
        hintStarCost,
        notes
      }
    });

    return res.status(200).json(successResponse({ policy }, 'Student policy updated successfully'));
  } catch (error) {
    return next(error);
  }
};

const requestContentRegeneration = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can create content flags'));
    }

    const { studentId } = req.params;
    const { gameType, levelNumber, reason } = req.body;

    const ownership = await ensureTeacherOwnsStudent(req.user.id, studentId);
    if (!ownership.ok) {
      return res.status(ownership.status).json(errorResponse(ownership.message));
    }

    const level = await prisma.levelDefinition.findFirst({
      where: {
        gameType,
        gameLevelNumber: levelNumber,
        isActive: true
      },
      select: { id: true }
    });

    if (!level) {
      return res.status(404).json(errorResponse('Level not found for that game track'));
    }

    const flag = await prisma.contentFlag.create({
      data: {
        teacherId: req.user.id,
        studentId,
        levelId: level.id,
        gameType,
        reason,
        status: 'PENDING'
      }
    });

    return res.status(201).json(successResponse({ flag }, 'Content regeneration request submitted'));
  } catch (error) {
    return next(error);
  }
};

const getMyContentFlags = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can view content flags'));
    }

    const { status } = req.query;

    const where = {
      teacherId: req.user.id,
      ...(status ? { status } : {})
    };

    const flags = await prisma.contentFlag.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        level: {
          select: {
            id: true,
            gameLevelNumber: true,
            title: true
          }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    const normalizedFlags = flags.map((flag) => ({
      ...flag,
      levelNumber: flag.level?.gameLevelNumber || null,
      levelTitle: flag.level?.title || null,
    }));

    return res.status(200).json(successResponse({ flags: normalizedFlags }, 'Content flags retrieved successfully'));
  } catch (error) {
    return next(error);
  }
};

const getTeacherLevelCanvas = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can access the level editor canvas'));
    }

    const { levelNumber } = req.params;
    const canvas = await getTeacherLevelCanvasData(req.user.id, levelNumber);

    return res.status(200).json(
      successResponse({ canvas }, 'Teacher level canvas retrieved successfully')
    );
  } catch (error) {
    return next(error);
  }
};

const saveTeacherLevelCanvas = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(errorResponse('Only teachers can save level editor canvas data'));
    }

    const { levelNumber } = req.params;
    const canvas = await saveTeacherLevelCanvasData(req.user.id, levelNumber, req.body || {});

    return res.status(200).json(
      successResponse({ canvas }, 'Teacher level canvas saved successfully')
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyStudentsRoster,
  getStudentProgressDetail,
  getRosterLeaderboard,
  upsertStudentPolicy,
  requestContentRegeneration,
  getMyContentFlags,
  getTeacherLevelCanvas,
  saveTeacherLevelCanvas,
};
