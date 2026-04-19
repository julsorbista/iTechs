const prisma = require('./src/lib/prisma');
const { createApp } = require('./src/app');

const app = createApp();
const PORT = process.env.PORT || 5000;

const registerShutdownHandlers = () => {
  const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Graceful shutdown...`);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    const server = app.listen(PORT, () => {
      console.log('\n========================================');
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log('========================================');
      console.log('\nDefault Test Accounts:');
      console.log('  Password for all accounts: 123456');
      console.log('\n  Super Admin: admin@itechs.com');
      console.log('  Teacher: john@teacher.com');
      console.log('  Student: jane@student.com');
      console.log('========================================\n');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\nPort Error: Port ${PORT} is already in use!`);
        console.error('\nSolutions:');
        console.error(`  1. Stop the process using port ${PORT}`);
        console.error('  2. Run: taskkill /F /IM node.exe');
        console.error('  3. Or change PORT in .env file\n');
        process.exit(1);
      }

      console.error('Server error:', error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

registerShutdownHandlers();

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
