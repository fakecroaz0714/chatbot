import { create } from 'zustand';
import api from '../services/api';

export const useMessageStore = create((set, get) => ({
  messages: [],
  isLoading: false,
  isLoadingOlder: false,
  error: null,
  hasMore: false,
  nextCursor: null,
  activeConversationId: null,

  fetchMessages: async (conversationId) => {
    if (!conversationId) return;

    set({
      isLoading: true,
      isLoadingOlder: false,
      error: null,
      messages: [],
      activeConversationId: conversationId,
      hasMore: false,
      nextCursor: null,
    });

    try {
      const response = await api.get(`/conversations/${conversationId}/messages?limit=50`);
      const data = response.data || {};
      if (!Array.isArray(data.messages)) {
        throw new Error('The server returned an invalid message history. Please try again.');
      }
      const messages = data.messages;

      // Ignore an older request that completed after the user switched chats.
      if (get().activeConversationId !== conversationId) return;

      set({
        messages,
        hasMore: Boolean(data.hasMore),
        nextCursor: data.nextCursor || null,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error fetching messages:', err);
      if (get().activeConversationId === conversationId) {
        set({
          isLoading: false,
          error: err.response?.data?.error || err.message || 'Could not load this conversation. Please try again.',
        });
      }
    }
  },

  fetchOlderMessages: async () => {
    const { activeConversationId, nextCursor, isLoadingOlder, hasMore, messages } = get();
    if (!activeConversationId || !nextCursor || isLoadingOlder || !hasMore) return;

    set({ isLoadingOlder: true });

    try {
      const response = await api.get(
        `/conversations/${activeConversationId}/messages?limit=50&before=${nextCursor}`
      );
      const data = response.data || {};
      const olderMessages = Array.isArray(data.messages) ? data.messages : [];
      const moreAvailable = Boolean(data.hasMore);
      const newCursor = data.nextCursor || null;

      if (get().activeConversationId !== activeConversationId) return;

      // Prepend older messages
      set({
        messages: [...olderMessages, ...messages],
        hasMore: moreAvailable,
        nextCursor: newCursor,
        isLoadingOlder: false,
      });
    } catch (err) {
      console.error('Error fetching older messages:', err);
      set({ isLoadingOlder: false });
    }
  },

  addMessage: (newMessage) => {
    if (!newMessage || typeof newMessage !== 'object') return;
    set((state) => {
      // Check if message already exists by id
      const existsIndex = state.messages.findIndex(
        (m) =>
          m.id === newMessage.id ||
          (newMessage.clientTempId && m.clientTempId === newMessage.clientTempId)
      );

      if (existsIndex !== -1) {
        const updated = [...state.messages];
        updated[existsIndex] = { ...updated[existsIndex], ...newMessage };
        return { messages: updated };
      }

      return { messages: [...state.messages, newMessage] };
    });
  },

  updateReceipt: (messageId, userId, readAt) => {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id === messageId) {
          const receipts = m.read_receipts || [];
          const alreadyRead = receipts.some((r) => r.user_id === userId);
          return {
            ...m,
            isRead: true,
            readCount: (m.readCount || 0) + (alreadyRead ? 0 : 1),
            read_receipts: alreadyRead
              ? receipts
              : [...receipts, { user_id: userId, read_at: readAt }],
          };
        }
        return m;
      }),
    }));
  },

  bulkUpdateReceipts: (messageIds, userId, readAt) => {
    const idSet = new Set(messageIds);
    set((state) => ({
      messages: state.messages.map((m) => {
        if (idSet.has(m.id)) {
          const receipts = m.read_receipts || [];
          const alreadyRead = receipts.some((r) => r.user_id === userId);
          return {
            ...m,
            isRead: true,
            readCount: (m.readCount || 0) + (alreadyRead ? 0 : 1),
            read_receipts: alreadyRead
              ? receipts
              : [...receipts, { user_id: userId, read_at: readAt }],
          };
        }
        return m;
      }),
    }));
  },

  clearMessages: () => {
    set({
      messages: [],
      isLoading: false,
      isLoadingOlder: false,
      error: null,
      activeConversationId: null,
      hasMore: false,
      nextCursor: null,
    });
  },
}));
