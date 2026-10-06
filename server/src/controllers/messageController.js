import prisma from '../db/prisma.js';

export const getMessages = async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const currentUserId = req.user.id;

    // Security: Validate conversation membership
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversation_id_user_id: {
          conversation_id: conversationId,
          user_id: currentUserId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this conversation.' });
    }

    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const whereClause = {
      conversation_id: conversationId,
    };

    // Cursor pagination (Section 14: cursor pagination with before=<messageId>)
    if (before) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: before },
        select: { created_at: true },
      });

      if (cursorMessage) {
        whereClause.created_at = {
          lt: cursorMessage.created_at,
        };
      }
    }

    // Fetch messages in descending order (newest first) for pagination
    const messages = await prisma.message.findMany({
      where: whereClause,
      take: pageSize + 1, // Fetch +1 to check hasMore
      orderBy: { created_at: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
        read_receipts: {
          select: {
            user_id: true,
            read_at: true,
          },
        },
      },
    });

    const hasMore = messages.length > pageSize;
    const results = hasMore ? messages.slice(0, pageSize) : messages;

    // Reverse results so client receives them in chronological order (oldest to newest)
    const chronologicalMessages = results.reverse().map((msg) => {
      // Check if read by someone else (for 1-on-1, or list of readers)
      const readByOthers = msg.read_receipts.filter((r) => r.user_id !== msg.sender_id);
      return {
        ...msg,
        isRead: readByOthers.length > 0,
        readCount: readByOthers.length,
      };
    });

    const nextCursor = hasMore ? results[0].id : null;

    return res.json({
      messages: chronologicalMessages,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
};
