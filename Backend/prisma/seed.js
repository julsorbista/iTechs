const bcrypt = require('bcrypt');
const {
  ensureLevelCatalog,
  getLevelDefinitionByGame,
} = require('../src/services/levelCatalogService');

const prisma = require('../src/lib/prisma');

const initializeStudentProgression = async (studentId) => {
  await ensureLevelCatalog();

  const levelDefinitions = await prisma.levelDefinition.findMany({
    where: { isActive: true },
    orderBy: [{ gameType: 'asc' }, { gameLevelNumber: 'asc' }],
  });

  await prisma.studentLevelState.createMany({
    data: levelDefinitions.map((level) => ({
      studentId,
      levelId: level.id,
      status: level.gameType === 'GAME_ONE' && level.gameLevelNumber === 1 ? 'UNLOCKED' : 'LOCKED',
      unlockedAt: level.gameType === 'GAME_ONE' && level.gameLevelNumber === 1 ? new Date() : null,
    })),
    skipDuplicates: true,
  });
};

const ensureTeacherStudentPolicy = async (teacherId, studentId) => {
  await prisma.teacherStudentPolicy.upsert({
    where: {
      teacherId_studentId: {
        teacherId,
        studentId,
      },
    },
    update: {
      teacherId,
      difficultyPreset: 'STANDARD',
      freeMistakes: 3,
      hintStarCost: 1,
      notes: 'Default policy applied by seed data.',
    },
    create: {
      teacherId,
      studentId,
      difficultyPreset: 'STANDARD',
      freeMistakes: 3,
      hintStarCost: 1,
      notes: 'Default policy applied by seed data.',
    },
  });
};

const ensureContentFlag = async ({ teacherId, studentId, resolverUserId }) => {
  await ensureLevelCatalog();

  const level = await getLevelDefinitionByGame('GAME_ONE', 1);
  if (!level) {
    return;
  }

  const existingFlag = await prisma.contentFlag.findFirst({
    where: {
      teacherId,
      studentId,
      levelId: level.id,
      gameType: 'GAME_ONE',
      reason: 'Sample review request seeded for moderation workflow.',
    },
    orderBy: {
      requestedAt: 'desc',
    },
  });

  if (existingFlag) {
    await prisma.contentFlag.update({
      where: { id: existingFlag.id },
      data: {
        status: 'IN_REVIEW',
        resolverUserId,
        resolutionNote: null,
        resolvedAt: null,
      },
    });
    return;
  }

  await prisma.contentFlag.create({
    data: {
      teacherId,
      studentId,
      levelId: level.id,
      gameType: 'GAME_ONE',
      reason: 'Sample review request seeded for moderation workflow.',
      status: 'IN_REVIEW',
      resolverUserId,
    },
  });
};

const ensureAuthTrail = async ({ studentId, actorUserId }) => {
  const existingAttempt = await prisma.loginAttempt.findFirst({
    where: {
      userId: studentId,
      usernameRaw: 'admin@student.com',
      success: true,
    },
  });

  if (!existingAttempt) {
    await prisma.loginAttempt.create({
      data: {
        userId: studentId,
        usernameRaw: 'admin@student.com',
        ipAddress: '127.0.0.1',
        success: true,
      },
    });
  }

  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      actorUserId,
      action: 'SEED_DATA_REFRESH',
      entityType: 'seed',
      entityId: 'bootstrap',
    },
  });

  if (!existingAudit) {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'SEED_DATA_REFRESH',
        entityType: 'seed',
        entityId: 'bootstrap',
        metadata: {
          seededBy: 'prisma/seed.js',
          sampleUsers: ['admin@gmail.com', 'admin@teacher.com', 'admin@student.com'],
        },
        ipAddress: '127.0.0.1',
      },
    });
  }
};

async function main() {
  console.log('Start seeding ...');
  const defaultPassword = '123456';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const accounts = {
    superAdmin: 'admin@gmail.com',
    teacher: 'admin@teacher.com',
    student: 'admin@student.com',
  };

  const superAdmin = await prisma.user.upsert({
    where: { email: accounts.superAdmin },
    update: {
      username: accounts.superAdmin,
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isArchived: false,
      isVerified: true,
      otpVerified: true,
      otpCode: null,
      otpExpiry: null,
    },
    create: {
      email: accounts.superAdmin,
      username: accounts.superAdmin,
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isArchived: false,
      isVerified: true,
      otpVerified: true,
    },
  });

  console.log('\nCreated Super Admin:');
  console.log('   Email:', superAdmin.email);
  console.log('   Username:', superAdmin.username);
  console.log('   Password:', defaultPassword);

  const teacher = await prisma.user.upsert({
    where: { email: accounts.teacher },
    update: {
      username: accounts.teacher,
      password: hashedPassword,
      firstName: 'Class',
      lastName: 'Teacher',
      role: 'TEACHER',
      courseCode: 'TEACH001',
      isArchived: false,
      isVerified: true,
      otpVerified: true,
      otpCode: null,
      otpExpiry: null,
    },
    create: {
      email: accounts.teacher,
      username: accounts.teacher,
      password: hashedPassword,
      firstName: 'Class',
      lastName: 'Teacher',
      role: 'TEACHER',
      courseCode: 'TEACH001',
      isArchived: false,
      isVerified: true,
      otpVerified: true,
    },
  });

  console.log('\nCreated Teacher:');
  console.log('   Email:', teacher.email);
  console.log('   Username:', teacher.username);
  console.log('   Password:', defaultPassword);

  const student = await prisma.user.upsert({
    where: { email: accounts.student },
    update: {
      username: accounts.student,
      password: hashedPassword,
      firstName: 'Game',
      lastName: 'Student',
      role: 'STUDENT',
      isArchived: false,
      isVerified: true,
      otpVerified: true,
      otpCode: null,
      otpExpiry: null,
      teacherId: teacher.id,
    },
    create: {
      email: accounts.student,
      username: accounts.student,
      password: hashedPassword,
      firstName: 'Game',
      lastName: 'Student',
      role: 'STUDENT',
      isArchived: false,
      isVerified: true,
      otpVerified: true,
      teacherId: teacher.id,
    },
  });

  console.log('\nCreated Student:');
  console.log('   Email:', student.email);
  console.log('   Username:', student.username);
  console.log('   Password:', defaultPassword);

  await ensureLevelCatalog();
  await initializeStudentProgression(student.id);

  const exam = await prisma.exam.upsert({
    where: { examCode: 'EXAM101' },
    update: {
      teacherId: teacher.id,
      isActive: true,
    },
    create: {
      title: 'Introduction to Computer Science',
      description: 'Basic concepts of computing',
      examCode: 'EXAM101',
      isActive: true,
      timeLimit: 60,
      totalMarks: 100,
      teacherId: teacher.id,
      questions: {
        create: [
          {
            question: 'What is the binary representation of 5?',
            options: ['101', '110', '111', '100'],
            correctAnswer: '101',
            marks: 10,
            type: 'multiple_choice',
          },
          {
            question: 'What does CPU stand for?',
            options: ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Central Processor Unit'],
            correctAnswer: 'Central Processing Unit',
            marks: 10,
            type: 'multiple_choice',
          },
        ],
      },
    },
  });

  await ensureTeacherStudentPolicy(teacher.id, student.id);
  await ensureContentFlag({
    teacherId: teacher.id,
    studentId: student.id,
    resolverUserId: superAdmin.id,
  });
  await ensureAuthTrail({
    studentId: student.id,
    actorUserId: superAdmin.id,
  });

  console.log('\nCreated Exam:', exam.title);
  console.log('\n========================================');
  console.log('Seeding finished successfully!');
  console.log('========================================');
  console.log('\nDefault Credentials:');
  console.log('   Password for all accounts: 123456');
  console.log(`\n   Super Admin: ${accounts.superAdmin}`);
  console.log(`   Teacher: ${accounts.teacher}`);
  console.log(`   Student: ${accounts.student}`);
  console.log('   OTP bypass is active for these three emails only.');
  console.log('========================================\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
