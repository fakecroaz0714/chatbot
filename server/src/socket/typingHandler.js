export const registerTypingHandlers = (io, socket) => {
  const user = socket.user;

  // typing:start
  socket.on('typing:start', ({ conversationId }) => {
    if (!conversationId) return;

    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      conversationId,
      userId: user.id,
      username: user.username,
    });
  });

  // typing:stop
  socket.on('typing:stop', ({ conversationId }) => {
    if (!conversationId) return;

    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      conversationId,
      userId: user.id,
      username: user.username,
    });
  });
};
