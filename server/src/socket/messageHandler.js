import prisma from '../db/prisma.js';

export const registerMessageHandlers = (io, socket) => {
  const currentUser = socket.user;

  /**
   * Sending a message
   * Section 8 flow:
   * 1. Validate conversation membership
   * 2. Save message to PostgreSQL (Prisma) before broadcasting
   * 3. Update conversation updated_at
   * 4. Emit message:new to conversation room
   * 5. Emit conversation:update to all member user rooms for sidebar real-time update
   */
  socket.on('message:send', async (data, callback) => {
    try {
      const {
        conversationId,
        content,
        messageType = 'TEXT',
        fileUrl = null,
        fileName = null,
        fileSize = null,
        clientTempId,
      } = data;

      if (!conversationId) {
        if (typeof callback === 'function') {
          return callback({ status: 'error', error: 'conversationId is required' });
        }
        return socket.emit('message:failed', { error: 'conversationId is required' });
      }

      if (!content && !fileUrl) {
        if (typeof callback === 'function') {
          return callback({ status: 'error', error: 'Message content or file is required' });
        }
        return socket.emit('message:failed', { error: 'Message content or file is required' });
      }

      // 1. Verify membership
      const membership = await prisma.conversationMember.findUnique({
        where: {
          conversation_id_user_id: {
            conversation_id: conversationId,
            user_id: currentUser.id,
          },
        },
        include: {
          conversation: {
            include: {
              members: {
                select: { user_id: true },
              },
            },
          },
        },
      });

      if (!membership) {
        if (typeof callback === 'function') {
          return callback({ status: 'error', error: 'Forbidden: Not a member of this conversation' });
        }
        return socket.emit('message:failed', { error: 'Not a member of this conversation' });
      }

      // 2. Save message to DB before broadcasting (Section 8 critical rule)
      const savedMessage = await prisma.message.create({
        data: {
          conversation_id: conversationId,
          sender_id: currentUser.id,
          content: content ? content.trim() : null,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
          read_receipts: true,
        },
      });

      // 3. Update conversation updated_at timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updated_at: new Date() },
      });

      const messagePayload = {
        ...savedMessage,
        clientTempId,
        isRead: false,
        readCount: 0,
      };

      // 4. Broadcast to the conversation room
      io.to(`conversation:${conversationId}`).emit('message:new', messagePayload);

      // 5. Broadcast conversation list preview update to all members' personal rooms
      const memberIds = membership.conversation.members.map((m) => m.user_id);
      memberIds.forEach((uid) => {
        io.to(`user:${uid}`).emit('conversation:updated', {
          conversationId,
          lastMessage: {
            id: savedMessage.id,
            content: savedMessage.content,
            message_type: savedMessage.message_type,
            sender_id: savedMessage.sender_id,
            sender_username: savedMessage.sender.username,
            created_at: savedMessage.created_at,
          },
          updated_at: savedMessage.created_at,
        });
      });

      // 6. Acknowledge sender
      if (typeof callback === 'function') {
        callback({ status: 'ok', message: messagePayload });
      } else {
        socket.emit('message:delivered', {
          id: savedMessage.id,
          clientTempId,
          conversationId,
          timestamp: savedMessage.created_at,
        });
      }
    } catch (error) {
      console.error('Error handling message:send:', error);
      if (typeof callback === 'function') {
        callback({ status: 'error', error: error.message });
      } else {
        socket.emit('message:failed', { error: 'Failed to process message' });
      }
    }
  });

  /**
   * Read receipts
   * Section 12:
   * socket.emit("message:read", { messageId, conversationId })
   */
  socket.on('message:read', async ({ messageId, conversationId }) => {
    try {
      if (!messageId && !conversationId) return;

      const readAt = new Date();

      if (messageId) {
        // Mark specific message as read
        await prisma.messageRead.upsert({
          where: {
            message_id_user_id: {
              message_id: messageId,
              user_id: currentUser.id,
            },
          },
          update: { read_at: readAt },
          create: {
            message_id: messageId,
            user_id: currentUser.id,
            read_at: readAt,
          },
        });

        // Broadcast to conversation room
        io.to(`conversation:${conversationId}`).emit('message:read:update', {
          messageId,
          conversationId,
          userId: currentUser.id,
          readAt,
        });
      } else if (conversationId) {
        // Mark all unread messages in conversation as read
        const unreadMessages = await prisma.message.findMany({
          where: {
            conversation_id: conversationId,
            sender_id: { not: currentUser.id },
            read_receipts: {
              none: { user_id: currentUser.id },
            },
          },
          select: { id: true },
        });

        if (unreadMessages.length > 0) {
          await Promise.all(
            unreadMessages.map((msg) =>
              prisma.messageRead.upsert({
                where: {
                  message_id_user_id: {
                    message_id: msg.id,
                    user_id: currentUser.id,
                  },
                },
                update: { read_at: readAt },
                create: {
                  message_id: msg.id,
                  user_id: currentUser.id,
                  read_at: readAt,
                },
              })
            )
          );

          io.to(`conversation:${conversationId}`).emit('message:read:bulk_update', {
            conversationId,
            userId: currentUser.id,
            messageIds: unreadMessages.map((m) => m.id),
            readAt,
          });
        }
      }
    } catch (err) {
      console.error('Error handling message:read:', err);
    }
  });
};
