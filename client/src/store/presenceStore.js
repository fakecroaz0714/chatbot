import { create } from 'zustand';

export const usePresenceStore = create((set, get) => ({
  onlineUsers: new Set(),

  setAllOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) });
  },

  setUserOnline: (userId) => {
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    });
  },

  setUserOffline: (userId) => {
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    });
  },

  isOnline: (userId) => {
    return get().onlineUsers.has(userId);
  },
}));
