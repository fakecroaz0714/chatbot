import { io } from 'socket.io-client';
import { getSocketUrl } from '../utils/config';

let socket = null;

export const getSocket = () => socket;

export const connectSocket = (token) => {
  if (socket) {
    if (socket.connected) return socket;
    socket.disconnect();
  }

  const socketUrl = getSocketUrl();
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
