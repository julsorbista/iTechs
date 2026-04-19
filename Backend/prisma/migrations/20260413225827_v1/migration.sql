-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'TEACHER', 'STUDENT') NOT NULL DEFAULT 'STUDENT',
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `section` VARCHAR(191) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `lastLogin` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `otpCode` VARCHAR(191) NULL,
    `otpExpiry` DATETIME(3) NULL,
    `otpVerified` BOOLEAN NOT NULL DEFAULT false,
    `teacherId` VARCHAR(191) NULL,
    `courseCode` VARCHAR(191) NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_courseCode_key`(`courseCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `purpose` ENUM('ACTIVATE', 'LOGIN', 'RESET') NOT NULL DEFAULT 'LOGIN',
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_tokens_userId_purpose_createdAt_idx`(`userId`, `purpose`, `createdAt`),
    INDEX `otp_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `usernameRaw` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `login_attempts_usernameRaw_createdAt_idx`(`usernameRaw`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_locks` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `lockedUntil` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `account_locks_userId_lockedUntil_idx`(`userId`, `lockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `audit_logs_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `examCode` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `timeLimit` INTEGER NULL,
    `totalMarks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `exams_examCode_key`(`examCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `options` JSON NULL,
    `correctAnswer` VARCHAR(191) NOT NULL,
    `marks` INTEGER NOT NULL DEFAULT 1,
    `type` VARCHAR(191) NOT NULL DEFAULT 'multiple_choice',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scores` (
    `id` VARCHAR(191) NOT NULL,
    `totalMarks` INTEGER NOT NULL,
    `obtainedMarks` INTEGER NOT NULL,
    `percentage` DOUBLE NOT NULL,
    `timeTaken` INTEGER NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `studentId` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `level_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `levelNumber` INTEGER NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL,
    `gameLevelNumber` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `level_definitions_gameType_gameLevelNumber_key`(`gameType`, `gameLevelNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dynamic_question_variants` (
    `id` VARCHAR(191) NOT NULL,
    `cacheScope` VARCHAR(191) NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL DEFAULT 'GAME_ONE',
    `requestFingerprint` VARCHAR(191) NOT NULL,
    `variantFingerprint` VARCHAR(191) NOT NULL,
    `questionsById` JSON NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `staleAt` DATETIME(3) NULL,
    `lastAssignedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dqv_scope_game_fp_stale_expires_idx`(`cacheScope`, `gameType`, `requestFingerprint`, `staleAt`, `expiresAt`),
    INDEX `dqv_expires_idx`(`expiresAt`),
    UNIQUE INDEX `dqv_scope_game_fp_variant_fp_key`(`cacheScope`, `gameType`, `requestFingerprint`, `variantFingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dynamic_question_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NULL,
    `cacheScope` VARCHAR(191) NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL DEFAULT 'GAME_ONE',
    `requestFingerprint` VARCHAR(191) NOT NULL,
    `loginSessionKey` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dqa_student_scope_game_fp_assigned_idx`(`studentId`, `cacheScope`, `gameType`, `requestFingerprint`, `assignedAt`),
    INDEX `dqa_variant_idx`(`variantId`),
    INDEX `dqa_expires_idx`(`expiresAt`),
    UNIQUE INDEX `dqa_student_scope_game_fp_login_key`(`studentId`, `cacheScope`, `gameType`, `requestFingerprint`, `loginSessionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_level_states` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `status` ENUM('LOCKED', 'UNLOCKED', 'COMPLETED') NOT NULL DEFAULT 'LOCKED',
    `attemptsCount` INTEGER NOT NULL DEFAULT 0,
    `bestStars` INTEGER NOT NULL DEFAULT 0,
    `bestScore` INTEGER NOT NULL DEFAULT 0,
    `unlockedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_level_states_studentId_status_idx`(`studentId`, `status`),
    UNIQUE INDEX `student_level_states_studentId_levelId_key`(`studentId`, `levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `game_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `levelNumber` INTEGER NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'IN_PROGRESS',
    `startingStars` INTEGER NOT NULL DEFAULT 3,
    `mistakes` INTEGER NOT NULL DEFAULT 0,
    `hintsUsed` INTEGER NOT NULL DEFAULT 0,
    `starsRemaining` INTEGER NOT NULL DEFAULT 3,
    `starsEarned` INTEGER NOT NULL DEFAULT 0,
    `retryMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `baseScore` INTEGER NOT NULL DEFAULT 0,
    `finalScore` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `game_sessions_studentId_levelNumber_createdAt_idx`(`studentId`, `levelNumber`, `createdAt`),
    INDEX `game_sessions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `level_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `attemptNumber` INTEGER NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL,
    `mistakes` INTEGER NOT NULL DEFAULT 0,
    `hintsUsed` INTEGER NOT NULL DEFAULT 0,
    `starsEarned` INTEGER NOT NULL DEFAULT 0,
    `baseScore` INTEGER NOT NULL DEFAULT 0,
    `finalScore` INTEGER NOT NULL DEFAULT 0,
    `retryMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `level_attempts_studentId_levelId_createdAt_idx`(`studentId`, `levelId`, `createdAt`),
    INDEX `level_attempts_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_student_policies` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `difficultyPreset` ENUM('EASY', 'STANDARD', 'HARD') NOT NULL DEFAULT 'STANDARD',
    `freeMistakes` INTEGER NOT NULL DEFAULT 3,
    `hintStarCost` INTEGER NOT NULL DEFAULT 1,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teacher_student_policies_studentId_idx`(`studentId`),
    UNIQUE INDEX `teacher_student_policies_teacherId_studentId_key`(`teacherId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_flags` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL DEFAULT 'GAME_ONE',
    `reason` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `resolutionNote` VARCHAR(191) NULL,
    `resolverUserId` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `content_flags_teacherId_requestedAt_idx`(`teacherId`, `requestedAt`),
    INDEX `content_flags_studentId_gameType_levelId_idx`(`studentId`, `gameType`, `levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `level_contents` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `draftJson` JSON NOT NULL,
    `publishedJson` JSON NOT NULL,
    `updatedByUserId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `level_contents_levelId_key`(`levelId`),
    INDEX `level_contents_updatedByUserId_updatedAt_idx`(`updatedByUserId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_level_records` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `levelNumber` INTEGER NOT NULL,
    `gridRows` INTEGER NOT NULL DEFAULT 18,
    `gridCols` INTEGER NOT NULL DEFAULT 32,
    `cellBackgrounds` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teacher_level_records_teacherId_updatedAt_idx`(`teacherId`, `updatedAt`),
    UNIQUE INDEX `teacher_level_records_teacherId_levelNumber_key`(`teacherId`, `levelNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_level_workspaces` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `gameType` ENUM('GAME_ONE', 'GAME_TWO', 'GAME_THREE') NOT NULL DEFAULT 'GAME_ONE',
    `levelNumber` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `teacher_level_workspaces_teacherId_updatedAt_idx`(`teacherId`, `updatedAt`),
    UNIQUE INDEX `teacher_level_workspaces_teacherId_gameType_levelNumber_key`(`teacherId`, `gameType`, `levelNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_level_versions` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `state` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `versionNumber` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `teacher_level_versions_workspaceId_state_createdAt_idx`(`workspaceId`, `state`, `createdAt`),
    INDEX `teacher_level_versions_createdByUserId_createdAt_idx`(`createdByUserId`, `createdAt`),
    UNIQUE INDEX `teacher_level_versions_workspaceId_state_versionNumber_key`(`workspaceId`, `state`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archived_users` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'TEACHER', 'STUDENT') NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `section` VARCHAR(191) NULL,
    `teacherId` VARCHAR(191) NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedBy` VARCHAR(191) NOT NULL,
    `archiveReason` VARCHAR(191) NULL,
    `userData` JSON NOT NULL,

    UNIQUE INDEX `archived_users_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_StudentExams` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_StudentExams_AB_unique`(`A`, `B`),
    INDEX `_StudentExams_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_tokens` ADD CONSTRAINT `otp_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_locks` ADD CONSTRAINT `account_locks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scores` ADD CONSTRAINT `scores_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scores` ADD CONSTRAINT `scores_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dynamic_question_assignments` ADD CONSTRAINT `dynamic_question_assignments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dynamic_question_assignments` ADD CONSTRAINT `dynamic_question_assignments_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dynamic_question_assignments` ADD CONSTRAINT `dynamic_question_assignments_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `dynamic_question_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_level_states` ADD CONSTRAINT `student_level_states_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_level_states` ADD CONSTRAINT `student_level_states_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `game_sessions` ADD CONSTRAINT `game_sessions_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `game_sessions` ADD CONSTRAINT `game_sessions_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_attempts` ADD CONSTRAINT `level_attempts_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_attempts` ADD CONSTRAINT `level_attempts_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_attempts` ADD CONSTRAINT `level_attempts_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `game_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_student_policies` ADD CONSTRAINT `teacher_student_policies_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_student_policies` ADD CONSTRAINT `teacher_student_policies_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_flags` ADD CONSTRAINT `content_flags_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_flags` ADD CONSTRAINT `content_flags_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_flags` ADD CONSTRAINT `content_flags_resolverUserId_fkey` FOREIGN KEY (`resolverUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_flags` ADD CONSTRAINT `content_flags_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_contents` ADD CONSTRAINT `level_contents_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_contents` ADD CONSTRAINT `level_contents_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_level_records` ADD CONSTRAINT `teacher_level_records_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_level_workspaces` ADD CONSTRAINT `teacher_level_workspaces_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_level_versions` ADD CONSTRAINT `teacher_level_versions_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `teacher_level_workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_level_versions` ADD CONSTRAINT `teacher_level_versions_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StudentExams` ADD CONSTRAINT `_StudentExams_A_fkey` FOREIGN KEY (`A`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_StudentExams` ADD CONSTRAINT `_StudentExams_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
