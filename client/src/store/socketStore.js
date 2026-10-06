import { create } from 'zustand';

export const useSocketStore = create((set, get) => ({
  isConnected: false,
  typingMap: {}, // conversationId -> Map of userId -> { username, timestamp }

  setIsConnected: (connected) => set({ isConnected: connected }),

  setTyping: (conversationId, userId, username) => {
    set((state) => {
      const currentConvTypers = { ...(state.typingMap[conversationId] || {}) };
      currentConvTypers[userId] = { username, timestamp: Date.now() };

      return {
        typingMap: {
          ...state.typingMap,
          [conversationId]: currentConvTypers,
        },
      };
    });
  },

  removeTyping: (conversationId, userId) => {
    set((state) => {
      const currentConvTypers = { ...(state.typingMap[conversationId] || {}) };
      delete currentConvTypers[userId];

      return {
        typingMap: {
          ...state.typingMap,
          [conversationId]: currentConvTypers,
        },
      };
    });
  },

  getTypingUsers: (conversationId) => {
    const state = get();
    const typers = state.typingMap[conversationId] || {};
    return Object.values(typers);
  },
}));
