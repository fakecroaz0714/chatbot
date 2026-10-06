import redisService from '../services/redisService.js';

export const handlePresenceOnConnect = async (io, socket) => {
  const userId = socket.user.id;
  const socketId = socket.id;

  const { wasOffline } = await redisService.addSocket(userId, socketId);

  if (wasOffline) {
    // Broadcast user:online to everyone
    io.emit('user:online', {
      userId,
      username: socket.user.username,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle presence:get event
  socket.on('presence:get', async (callback) => {
    try {
      const onlineUsers = await redisService.getAllOnlineUsers();
      if (typeof callback === 'function') {
        callback({ onlineUsers });
      } else {
        socket.emit('presence:update', { onlineUsers });
      }
    } catch (err) {
      console.error('Error in presence:get:', err);
    }
  });
};

export const handlePresenceOnDisconnect = async (io, socket) => {
  const userId = socket.user?.id;
  if (!userId) return;

  const { isNowOffline } = await redisService.removeSocket(userId, socket.id);

  if (isNowOffline) {
    // Broadcast user:offline to everyone
    io.emit('user:offline', {
      userId,
      username: socket.user.username,
      timestamp: new Date().toISOString(),
    });
  }
};
