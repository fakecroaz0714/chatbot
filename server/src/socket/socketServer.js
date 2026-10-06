import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import prisma from '../db/prisma.js';
import redisService from '../services/redisService.js';
import { socketAuthMiddleware } from './socketAuth.js';
import { handlePresenceOnConnect, handlePresenceOnDisconnect } from './presenceHandler.js';
import { registerMessageHandlers } from './messageHandler.js';
import { registerTypingHandlers } from './typingHandler.js';

export const initSocketServer = (httpServer) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const io = new Server(httpServer, {
    cors: {
      origin: [clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // Attach Redis Adapter if Redis is connected (Section 17: Redis architecture for horizontal scaling)
  if (redisService.isRedisConnected && redisService.pubClient && redisService.subClient) {
    try {
      io.adapter(createAdapter(redisService.pubClient, redisService.subClient));
      console.log('[Socket.IO] Using Redis Adapter for horizontal scalability');
    } catch (e) {
      console.warn('[Socket.IO] Failed to attach Redis adapter, running in local mode:', e.message);
    }
  }

  // Socket Authentication Middleware
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[Socket.IO] User connected: ${user.username} (${user.id}) | Socket ID: ${socket.id}`);

    // Join user's personal room (for direct notifications across devices)
    socket.join(`user:${user.id}`);

    // Join all conversation rooms user belongs to (Section 7)
    try {
      const memberships = await prisma.conversationMember.findMany({
        where: { user_id: user.id },
        select: { conversation_id: true },
      });

      memberships.forEach((m) => {
        socket.join(`conversation:${m.conversation_id}`);
      });
    } catch (err) {
      console.error('[Socket.IO] Failed to join existing conversation rooms:', err);
    }

    // Dynamic room join/leave (when a new conversation is started or selected)
    socket.on('conversation:join', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Register presence handlers
    await handlePresenceOnConnect(io, socket);

    // Register message and typing handlers
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);

    // Disconnect event
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket.IO] User disconnected: ${user.username} (${socket.id}) reason: ${reason}`);
      await handlePresenceOnDisconnect(io, socket);
    });
  });

  return io;
};
