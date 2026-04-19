const { 
  successResponse,
  errorResponse,
  getPaginationData,
  generateExamCode
} = require('../utils/helpers');
const prisma = require('../lib/prisma');

// Get all exams (with pagination and filtering)
const getExams = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    
    const where = {};
    
    // Apply role-based filtering
    if (req.user.role === 'TEACHER') {
      where.teacherId = req.user.id;
    } else if (req.user.role === 'STUDENT') {
      where.students = {
        some: {
          id: req.user.id
        }
      };
    }
    
    // Apply other filters
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { examCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.exam.count({ where });
    
    // Get pagination data
    const paginationData = getPaginationData(page, limit, totalCount);
    
    // Get exams
    const exams = await prisma.exam.findMany({
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
            students: true,
            scores: true,
            questions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: paginationData.offset,
      take: paginationData.limit
    });

    res.status(200).json(
      successResponse(
        {
          exams,
          ...paginationData.pagination
        },
        'Exams retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Get exam by ID
const getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const exam = await prisma.exam.findUnique({
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
        students: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        questions: {
          select: {
            id: true,
            question: true,
            options: true,
            type: true,
            marks: true,
            ...(req.user.role === 'TEACHER' && { correctAnswer: true })
          }
        },
        scores: {
          include: {
            student: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!exam) {
      return res.status(404).json(
        errorResponse('Exam not found')
      );
    }

    // Check access permissions
    if (req.user.role === 'TEACHER' && exam.teacherId !== req.user.id) {
      return res.status(403).json(
        errorResponse('You can only access your own exams')
      );
    } else if (req.user.role === 'STUDENT') {
      // Check if student is enrolled in the exam
      const isEnrolled = exam.students.some(student => student.id === req.user.id);
      if (!isEnrolled) {
        return res.status(403).json(
          errorResponse('You are not enrolled in this exam')
        );
      }
    }

    res.status(200).json(
      successResponse(
        exam,
        'Exam retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Get exam by code (for students to join)
const getExamByCode = async (req, res, next) => {
  try {
    const { examCode } = req.params;
    
    const exam = await prisma.exam.findUnique({
      where: { 
        examCode: examCode.toUpperCase(),
        isActive: true
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            questions: true,
            students: true
          }
        }
      }
    });

    if (!exam) {
      return res.status(404).json(
        errorResponse('Invalid exam code or exam is not active')
      );
    }

    // Don't include questions or sensitive data for preview
    res.status(200).json(
      successResponse(
        {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          examCode: exam.examCode,
          timeLimit: exam.timeLimit,
          totalMarks: exam.totalMarks,
          teacher: exam.teacher,
          questionCount: exam._count.questions,
          studentCount: exam._count.students
        },
        'Exam found successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Create new exam (teachers only)
const createExam = async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json(
        errorResponse('Only teachers can create exams')
      );
    }

    const { title, description, timeLimit, totalMarks } = req.body;
    
    // Generate unique exam code
    let examCode;
    let isUnique = false;
    
    while (!isUnique) {
      examCode = generateExamCode();
      const existing = await prisma.exam.findUnique({
        where: { examCode }
      });
      isUnique = !existing;
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        description: description || null,
        examCode,
        timeLimit: timeLimit || null,
        totalMarks: totalMarks || 0,
        teacherId: req.user.id
      },
      include: {
        teacher: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json(
      successResponse(
        exam,
        'Exam created successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Update exam
const updateExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, timeLimit, totalMarks, isActive } = req.body;
    
    // Find exam
    const exam = await prisma.exam.findUnique({
      where: { id }
    });

    if (!exam) {
      return res.status(404).json(
        errorResponse('Exam not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'SUPER_ADMIN' && exam.teacherId !== req.user.id) {
      return res.status(403).json(
        errorResponse('You can only update your own exams')
      );
    }

    const updatedExam = await prisma.exam.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(timeLimit !== undefined && { timeLimit }),
        ...(totalMarks !== undefined && { totalMarks }),
        ...(isActive !== undefined && { isActive })
      },
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
            questions: true,
            students: true,
            scores: true
          }
        }
      }
    });

    res.status(200).json(
      successResponse(
        updatedExam,
        'Exam updated successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Delete exam
const deleteExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find exam
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            scores: true
          }
        }
      }
    });

    if (!exam) {
      return res.status(404).json(
        errorResponse('Exam not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'SUPER_ADMIN' && exam.teacherId !== req.user.id) {
      return res.status(403).json(
        errorResponse('You can only delete your own exams')
      );
    }

    // Check if exam has scores (completed attempts)
    if (exam._count.scores > 0) {
      return res.status(400).json(
        errorResponse('Cannot delete exam with existing student scores')
      );
    }

    await prisma.exam.delete({
      where: { id }
    });

    res.status(200).json(
      successResponse(
        null,
        'Exam deleted successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Join exam (students)
const joinExam = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json(
        errorResponse('Only students can join exams')
      );
    }

    const { examCode } = req.body;
    
    const exam = await prisma.exam.findUnique({
      where: { 
        examCode: examCode.toUpperCase(),
        isActive: true
      }
    });

    if (!exam) {
      return res.status(404).json(
        errorResponse('Invalid exam code or exam is not active')
      );
    }

    // Check if already joined
    const existingEnrollment = await prisma.exam.findFirst({
      where: {
        id: exam.id,
        students: {
          some: {
            id: req.user.id
          }
        }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json(
        errorResponse('You are already enrolled in this exam')
      );
    }

    // Add student to exam
    const updatedExam = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        students: {
          connect: { id: req.user.id }
        }
      },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(200).json(
      successResponse(
        {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          examCode: exam.examCode,
          timeLimit: exam.timeLimit,
          teacher: updatedExam.teacher
        },
        'Successfully joined the exam'
      )
    );
  } catch (error) {
    next(error);
  }
};

// Get exam statistics (for teachers)
const getExamStatistics = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        scores: {
          include: {
            student: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { percentage: 'desc' }
        },
        _count: {
          select: {
            students: true,
            questions: true
          }
        }
      }
    });

    if (!exam) {
      return res.status(404).json(
        errorResponse('Exam not found')
      );
    }

    // Check permissions
    if (req.user.role === 'TEACHER' && exam.teacherId !== req.user.id) {
      return res.status(403).json(
        errorResponse('You can only view statistics for your own exams')
      );
    }

    // Calculate statistics
    const scores = exam.scores.map(score => score.percentage);
    const statistics = {
      totalStudents: exam._count.students,
      completedAttempts: exam.scores.length,
      completionRate: exam._count.students > 0 
        ? ((exam.scores.length / exam._count.students) * 100).toFixed(2)
        : 0,
      averageScore: scores.length > 0 
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      questionCount: exam._count.questions
    };

    res.status(200).json(
      successResponse(
        {
          exam: {
            id: exam.id,
            title: exam.title,
            examCode: exam.examCode,
            totalMarks: exam.totalMarks
          },
          statistics,
          scores: exam.scores
        },
        'Exam statistics retrieved successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExams,
  getExamById,
  getExamByCode,
  createExam,
  updateExam,
  deleteExam,
  joinExam,
  getExamStatistics
};
