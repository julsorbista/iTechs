const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma = globalForPrisma.__ITECHS_PRISMA__ || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['info', 'warn', 'error']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__ITECHS_PRISMA__ = prisma;
}

module.exports = prisma;
