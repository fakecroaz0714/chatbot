import prisma from '../db/prisma.js';
import redisService from '../services/redisService.js';

export const getUsers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const currentUserId = req.user.id;

    const whereClause = {
      id: { not: currentUserId },
    };

    if (search && search.trim()) {
      whereClause.OR = [
        { username: { contains: search.trim() } },
        { email: { contains: search.trim() } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
        created_at: true,
      },
      take: 20,
    });

    const onlineUsers = await redisService.getAllOnlineUsers();
    const onlineSet = new Set(onlineUsers);

    const enrichedUsers = users.map((u) => ({
      ...u,
      isOnline: onlineSet.has(u.id),
    }));

    return res.json({ users: enrichedUsers });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOnline = await redisService.isUserOnline(user.id);

    return res.json({ user: { ...user, isOnline } });
  } catch (error) {
    next(error);
  }
};
