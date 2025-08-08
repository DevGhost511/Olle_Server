import config from './config/config';
import app from './app';
import redisClient from './config/redisClient';
import connectDB from './config/db';

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    await redisClient.quit();
    console.log('Redis connection closed');
  } catch (err) {
    console.warn('Error closing Redis connection:', err);
  }
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    await redisClient.quit();
    console.log('Redis connection closed');
  } catch (err) {
    console.warn('Error closing Redis connection:', err);
  }
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Try to connect to Redis, but don't fail if it's not available
redisClient.connect().then(() => {
  console.log('✅ Redis connected successfully');
}).catch((err) => {
  console.log(err);
  console.warn('⚠️  Redis connection failed, continuing without Redis:', err.message);
  console.warn('💡 To fix this: Install and start Redis server, or set REDIS_URL environment variable');
  });

connectDB();