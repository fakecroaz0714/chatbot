import Redis from 'ioredis';

class RedisPresenceService {
  constructor() {
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.isRedisConnected = false;
    this.client = null;
    this.pubClient = null;
    this.subClient = null;

    // In-memory fallback if Redis is not running
    this.memorySockets = new Map(); // userId -> Set<socketId>

    this.init();
  }

  init() {
    try {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 2) {
            return null; // Stop retrying after 2 attempts to prevent spamming
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      this.client.connect().then(() => {
        this.isRedisConnected = true;
        console.log('[Redis] Connected successfully to Redis server at', this.redisUrl);

        // Also setup pub/sub clients if connected
        this.pubClient = this.client.duplicate();
        this.subClient = this.client.duplicate();
      }).catch((err) => {
        this.isRedisConnected = false;
        console.log('[Redis] Redis not reachable (' + err.message + '). Using in-memory presence & Pub/Sub adapter for development.');
      });

      this.client.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn('[Redis] Connection error, switching to memory fallback:', err.message);
          this.isRedisConnected = false;
        }
      });
    } catch (e) {
      this.isRedisConnected = false;
      console.log('[Redis] Initializing with in-memory presence fallback.');
    }
  }

  /**
   * Add a socket connection for a user.
   * Supports multiple devices (phone, laptop, tablet).
   * Returns: { wasOffline: boolean, totalSockets: number }
   */
  async addSocket(userId, socketId) {
    if (this.isRedisConnected && this.client) {
      try {
        const key = `user:${userId}:sockets`;
        const initialCount = await this.client.scard(key);
        await this.client.sadd(key, socketId);
        await this.client.sadd('online_users', userId);
        return {
          wasOffline: initialCount === 0,
          totalSockets: initialCount + 1,
        };
      } catch (err) {
        console.error('[Redis] addSocket error:', err);
      }
    }

    // Memory fallback
    if (!this.memorySockets.has(userId)) {
      this.memorySockets.set(userId, new Set());
    }
    const set = this.memorySockets.get(userId);
    const wasOffline = set.size === 0;
    set.add(socketId);
    return { wasOffline, totalSockets: set.size };
  }

  /**
   * Remove a socket connection for a user.
   * Returns: { isNowOffline: boolean, remainingSockets: number }
   */
  async removeSocket(userId, socketId) {
    if (this.isRedisConnected && this.client) {
      try {
        const key = `user:${userId}:sockets`;
        await this.client.srem(key, socketId);
        const remaining = await this.client.scard(key);
        if (remaining === 0) {
          await this.client.srem('online_users', userId);
          await this.client.del(key);
        }
        return {
          isNowOffline: remaining === 0,
          remainingSockets: remaining,
        };
      } catch (err) {
        console.error('[Redis] removeSocket error:', err);
      }
    }

    // Memory fallback
    if (!this.memorySockets.has(userId)) {
      return { isNowOffline: true, remainingSockets: 0 };
    }
    const set = this.memorySockets.get(userId);
    set.delete(socketId);
    const remaining = set.size;
    if (remaining === 0) {
      this.memorySockets.delete(userId);
    }
    return {
      isNowOffline: remaining === 0,
      remainingSockets: remaining,
    };
  }

  /**
   * Check if user is online.
   */
  async isUserOnline(userId) {
    if (this.isRedisConnected && this.client) {
      try {
        return (await this.client.sismember('online_users', userId)) === 1;
      } catch (err) {
        console.error('[Redis] isUserOnline error:', err);
      }
    }
    return this.memorySockets.has(userId) && this.memorySockets.get(userId).size > 0;
  }

  /**
   * Get set of all currently online user IDs.
   */
  async getAllOnlineUsers() {
    if (this.isRedisConnected && this.client) {
      try {
        const users = await this.client.smembers('online_users');
        return users;
      } catch (err) {
        console.error('[Redis] getAllOnlineUsers error:', err);
      }
    }
    return Array.from(this.memorySockets.keys());
  }
}

const redisService = new RedisPresenceService();
export default redisService;
