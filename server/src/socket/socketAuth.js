import { verifyToken } from '../utils/token.js';
import prisma from '../db/prisma.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
      },
    });

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach authenticated user to socket
    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Internal socket authentication error'));
  }
};
