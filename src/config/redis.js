const { Redis } = require('ioredis');

const createRedisClient = () => {
    const client = new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        lazyConnect: true,
        retryStrategy(times) {
            const delay = Math.min(times * 500, 30000);
            console.warn(`⚠️ Redis connection retry attempt #${times}. Waiting ${delay}ms...`);
            return delay;
        }
    });


    client.on('connect', () => {
        console.log('🔴 Redis client connected');
    });
    client.on('error', (err) => {
        console.error('❌ Redis client error:', err.message);
    });

    return client;
};

module.exports = { createRedisClient };