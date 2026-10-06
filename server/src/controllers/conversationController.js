import prisma from '../db/prisma.js';
import redisService from '../services/redisService.js';

export const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Find all conversations where current user is a member
    const memberships = await prisma.conversationMember.findMany({
      where: { user_id: currentUserId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                    avatar_url: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { created_at: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { id: true, username: true },
                },
              },
            },
          },
        },
      },
      orderBy: { conversation: { updated_at: 'desc' } },
    });

    const onlineUsers = await redisService.getAllOnlineUsers();
    const onlineSet = new Set(onlineUsers);

    // Compute unread count for each conversation
    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const conv = m.conversation;
        const lastMessage = conv.messages[0] || null;

        // Unread messages count: messages in this conversation where sender != currentUserId AND not in MessageRead for this user
        const unreadCount = await prisma.message.count({
          where: {
            conversation_id: conv.id,
            sender_id: { not: currentUserId },
            read_receipts: {
              none: { user_id: currentUserId },
            },
          },
        });

        // Format members with online presence
        const formattedMembers = conv.members.map((mem) => ({
          ...mem.user,
          isOnline: onlineSet.has(mem.user.id),
        }));

        // Determine display title & avatar for DIRECT chats
        let displayTitle = conv.title;
        let displayAvatar = null;
        let otherUser = null;

        if (conv.type === 'DIRECT') {
          otherUser = formattedMembers.find((mem) => mem.id !== currentUserId) || formattedMembers[0];
          displayTitle = otherUser ? otherUser.username : 'Direct Chat';
          displayAvatar = otherUser ? otherUser.avatar_url : null;
        }

        return {
          id: conv.id,
          type: conv.type,
          title: displayTitle,
          avatar: displayAvatar,
          otherUser,
          members: formattedMembers,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                message_type: lastMessage.message_type,
                sender_id: lastMessage.sender_id,
                sender_username: lastMessage.sender.username,
                created_at: lastMessage.created_at,
              }
            : null,
          unreadCount,
          updated_at: conv.updated_at,
        };
      })
    );

    // Sort by last activity
    conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return res.json({ conversations });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { recipientId, memberIds, type = 'DIRECT', title } = req.body;

    if (type === 'DIRECT') {
      if (!recipientId) {
        return res.status(400).json({ error: 'recipientId is required for direct conversation.' });
      }

      if (recipientId === currentUserId) {
        return res.status(400).json({ error: 'Cannot create direct conversation with yourself.' });
      }

      // Check if direct conversation already exists between these 2 users
      const existingConversations = await prisma.conversation.findMany({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { user_id: currentUserId } } },
            { members: { some: { user_id: recipientId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, email: true, avatar_url: true },
              },
            },
          },
        },
      });

      if (existingConversations.length > 0) {
        const conv = existingConversations[0];
        const otherUser = conv.members.find((m) => m.user.id !== currentUserId)?.user;
        const isOnline = otherUser ? await redisService.isUserOnline(otherUser.id) : false;

        return res.json({
          conversation: {
            id: conv.id,
            type: conv.type,
            title: otherUser?.username || 'Direct Chat',
            avatar: otherUser?.avatar_url,
            otherUser: otherUser ? { ...otherUser, isOnline } : null,
            members: conv.members.map((m) => m.user),
            updated_at: conv.updated_at,
          },
          isExisting: true,
        });
      }

      // Create new direct conversation
      const conversation = await prisma.conversation.create({
        data: {
          type: 'DIRECT',
          members: {
            create: [
              { user_id: currentUserId },
              { user_id: recipientId },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, email: true, avatar_url: true },
              },
            },
          },
        },
      });

      const otherUser = conversation.members.find((m) => m.user.id !== currentUserId)?.user;
      const isOnline = otherUser ? await redisService.isUserOnline(otherUser.id) : false;

      return res.status(201).json({
        conversation: {
          id: conversation.id,
          type: conversation.type,
          title: otherUser?.username || 'Direct Chat',
          avatar: otherUser?.avatar_url,
          otherUser: otherUser ? { ...otherUser, isOnline } : null,
          members: conversation.members.map((m) => m.user),
          updated_at: conversation.updated_at,
        },
        isExisting: false,
      });
    }

    // Group conversation
    const allMembers = Array.from(new Set([currentUserId, ...(memberIds || [])]));
    if (allMembers.length < 2) {
      return res.status(400).json({ error: 'Group conversation requires at least 2 members.' });
    }

    const groupConversation = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        title: title || 'Group Chat',
        members: {
          create: allMembers.map((uid) => ({ user_id: uid })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, avatar_url: true },
            },
          },
        },
      },
    });

    return res.status(201).json({
      conversation: {
        id: groupConversation.id,
        type: groupConversation.type,
        title: groupConversation.title,
        members: groupConversation.members.map((m) => m.user),
        updated_at: groupConversation.updated_at,
      },
      isExisting: false,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    // Security check: ensure current user is a member
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversation_id_user_id: {
          conversation_id: id,
          user_id: currentUserId,
        },
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this conversation.' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, avatar_url: true },
            },
          },
        },
      },
    });

    const onlineUsers = await redisService.getAllOnlineUsers();
    const onlineSet = new Set(onlineUsers);

    const formattedMembers = conversation.members.map((m) => ({
      ...m.user,
      isOnline: onlineSet.has(m.user.id),
    }));

    let displayTitle = conversation.title;
    let displayAvatar = null;
    let otherUser = null;

    if (conversation.type === 'DIRECT') {
      otherUser = formattedMembers.find((m) => m.id !== currentUserId) || formattedMembers[0];
      displayTitle = otherUser ? otherUser.username : 'Direct Chat';
      displayAvatar = otherUser ? otherUser.avatar_url : null;
    }

    return res.json({
      conversation: {
        id: conversation.id,
        type: conversation.type,
        title: displayTitle,
        avatar: displayAvatar,
        otherUser,
        members: formattedMembers,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
