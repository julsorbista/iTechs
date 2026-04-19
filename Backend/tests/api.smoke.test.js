process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const prisma = require('../src/lib/prisma');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/utils/helpers');
const { ensureLevelCatalog, getLevelDefinitionByGame } = require('../src/services/levelCatalogService');

const app = createApp();

const ADMIN_ACCOUNT = Object.freeze({
  username: 'smoke.admin@itechs.com',
  email: 'smoke.admin@itechs.com',
  password: 'SmokeAdmin@123',
  firstName: 'Smoke',
  lastName: 'Admin',
  role: 'SUPER_ADMIN',
});

const STUDENT_ACCOUNT = Object.freeze({
  username: 'smoke.player@student.com',
  email: 'smoke.player@student.com',
  password: 'SmokePlayer@123',
  firstName: 'Smoke',
  lastName: 'Player',
  role: 'STUDENT',
});

const TEST_LEVEL = Object.freeze({
  gameType: 'GAME_ONE',
  levelNumber: 1,
});

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const upsertLoginUser = async (account) => {
  const hashedPassword = await hashPassword(account.password);

  return prisma.user.upsert({
    where: { username: account.username },
    update: {
      email: account.email,
      password: hashedPassword,
      role: account.role,
      firstName: account.firstName,
      lastName: account.lastName,
      isVerified: true,
      isArchived: false,
    },
    create: {
      username: account.username,
      email: account.email,
      password: hashedPassword,
      role: account.role,
      firstName: account.firstName,
      lastName: account.lastName,
      isVerified: true,
    },
  });
};

let adminToken;
let studentToken;
let originalLevelContent;
let smokeAdminUserId;
let smokeStudentUserId;

const loginUser = async (account) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      username: account.username,
      password: account.password,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'success');
  assert.ok(response.body.data.token);

  return response.body.data.token;
};

test.before(async () => {
  await prisma.$connect();
  await ensureLevelCatalog();

  const adminUser = await upsertLoginUser(ADMIN_ACCOUNT);
  const studentUser = await upsertLoginUser(STUDENT_ACCOUNT);
  smokeAdminUserId = adminUser.id;
  smokeStudentUserId = studentUser.id;

  const level = await getLevelDefinitionByGame(TEST_LEVEL.gameType, TEST_LEVEL.levelNumber);
  const content = await prisma.levelContent.findUnique({
    where: { levelId: level.id },
    select: {
      levelId: true,
      draftJson: true,
      publishedJson: true,
      publishedAt: true,
      updatedByUserId: true,
    },
  });

  originalLevelContent = {
    levelId: content.levelId,
    draftJson: cloneJson(content.draftJson),
    publishedJson: cloneJson(content.publishedJson),
    publishedAt: content.publishedAt,
    updatedByUserId: content.updatedByUserId,
  };
});

test.after(async () => {
  if (originalLevelContent) {
    await prisma.levelContent.update({
      where: { levelId: originalLevelContent.levelId },
      data: {
        draftJson: originalLevelContent.draftJson,
        publishedJson: originalLevelContent.publishedJson,
        publishedAt: originalLevelContent.publishedAt,
        updatedByUserId: originalLevelContent.updatedByUserId,
      },
    });
  }

  if (smokeStudentUserId) {
    await prisma.levelAttempt.deleteMany({
      where: { studentId: smokeStudentUserId },
    });

    await prisma.gameSession.deleteMany({
      where: { studentId: smokeStudentUserId },
    });

    await prisma.studentLevelState.deleteMany({
      where: { studentId: smokeStudentUserId },
    });
  }

  const smokeUserIds = [smokeAdminUserId, smokeStudentUserId].filter(Boolean);
  if (smokeUserIds.length > 0) {
    await prisma.accountLock.deleteMany({
      where: { userId: { in: smokeUserIds } },
    });

    await prisma.loginAttempt.deleteMany({
      where: { userId: { in: smokeUserIds } },
    });

    await prisma.auditLog.deleteMany({
      where: {
        actorUserId: { in: smokeUserIds },
      },
    });
  }

  await prisma.$disconnect();
});

test('auth login returns a token and /api/auth/profile resolves the active user', async () => {
  adminToken = await loginUser(ADMIN_ACCOUNT);

  const profileResponse = await request(app)
    .get('/api/auth/profile')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(profileResponse.status, 200);
  assert.equal(profileResponse.body.status, 'success');
  assert.equal(profileResponse.body.data.username, ADMIN_ACCOUNT.username);
  assert.equal(profileResponse.body.data.role, 'SUPER_ADMIN');
});

test('admin draft and publish endpoints update student-playable level content', async () => {
  adminToken = await loginUser(ADMIN_ACCOUNT);
  studentToken = await loginUser(STUDENT_ACCOUNT);

  const catalogResponse = await request(app)
    .get('/api/admin/levels/catalog')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(catalogResponse.status, 200);
  assert.equal(catalogResponse.body.status, 'success');
  assert.ok(Array.isArray(catalogResponse.body.data.games));
  assert.ok(catalogResponse.body.data.games.length > 0);

  const contentResponse = await request(app)
    .get(`/api/admin/levels/${TEST_LEVEL.gameType}/${TEST_LEVEL.levelNumber}/content`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(contentResponse.status, 200);
  assert.equal(contentResponse.body.status, 'success');

  const updatedDraft = cloneJson(contentResponse.body.data.content.draftJson);
  updatedDraft.title = `Smoke Publish ${Date.now()}`;

  const draftSaveResponse = await request(app)
    .put(`/api/admin/levels/${TEST_LEVEL.gameType}/${TEST_LEVEL.levelNumber}/content/draft`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ levelData: updatedDraft });

  assert.equal(draftSaveResponse.status, 200);
  assert.equal(draftSaveResponse.body.status, 'success');
  assert.equal(draftSaveResponse.body.data.content.draftJson.title, updatedDraft.title);

  const publishResponse = await request(app)
    .post(`/api/admin/levels/${TEST_LEVEL.gameType}/${TEST_LEVEL.levelNumber}/content/publish`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(publishResponse.status, 200);
  assert.equal(publishResponse.body.status, 'success');
  assert.equal(publishResponse.body.data.content.publishedJson.title, updatedDraft.title);
  assert.ok(publishResponse.body.data.content.publishedAt);

  const playableResponse = await request(app)
    .get(`/api/levels/${TEST_LEVEL.gameType}/${TEST_LEVEL.levelNumber}/content`)
    .set('Authorization', `Bearer ${studentToken}`);

  assert.equal(playableResponse.status, 200);
  assert.equal(playableResponse.body.status, 'success');
  assert.equal(playableResponse.body.data.levelData.title, updatedDraft.title);
});

test('student progression routes still allow start and submit for the published level', async () => {
  studentToken = await loginUser(STUDENT_ACCOUNT);

  const startResponse = await request(app)
    .post(`/api/levels/${TEST_LEVEL.gameType}/${TEST_LEVEL.levelNumber}/sessions/start`)
    .set('Authorization', `Bearer ${studentToken}`);

  assert.equal(startResponse.status, 201);
  assert.equal(startResponse.body.status, 'success');
  assert.ok(startResponse.body.data.sessionId);

  const submitResponse = await request(app)
    .post(`/api/levels/${TEST_LEVEL.gameType}/${TEST_LEVEL.levelNumber}/sessions/${startResponse.body.data.sessionId}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      outcome: 'COMPLETED',
      mistakes: 0,
      hintsUsed: 0,
      baseScore: 100,
    });

  assert.equal(submitResponse.status, 200);
  assert.equal(submitResponse.body.status, 'success');
  assert.equal(submitResponse.body.data.result, 'COMPLETED');
});
