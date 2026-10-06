import { create } from 'zustand';
import api from '../services/api';

export const useConversationStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  isLoading: false,
  error: null,

  fetchConversations: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get('/conversations');
      const conversations = Array.isArray(response.data?.conversations)
        ? response.data.conversations.filter((conversation) => conversation && conversation.id)
        : [];
      set({ conversations, isLoading: false, error: null });

      // If active conversation exists, update its reference
      const active = get().activeConversation;
      if (active) {
        const updatedActive = conversations.find((c) => c.id === active.id);
        if (updatedActive) {
          set({ activeConversation: updatedActive });
        }
      }
    } catch (err) {
      set({ error: err.response?.data?.error || err.message || 'Could not load conversations.', isLoading: false });
    }
  },

  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation });
    if (conversation) {
      get().clearUnread(conversation.id);
    }
  },

  addOrSelectConversation: (conversation) => {
    const list = get().conversations;
    const exists = list.find((c) => c.id === conversation.id);

    if (exists) {
      set({
        conversations: list.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)),
        activeConversation: { ...exists, ...conversation },
      });
    } else {
      set({
        conversations: [conversation, ...list],
        activeConversation: conversation,
      });
    }
  },

  updateConversationLastMessage: (conversationId, lastMessage, updatedAt) => {
    set((state) => {
      const active = state.activeConversation;
      const isCurrentActive = active && active.id === conversationId;

      const updated = state.conversations.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessage,
            updated_at: updatedAt || new Date().toISOString(),
            unreadCount: isCurrentActive ? 0 : (conv.unreadCount || 0) + 1,
          };
        }
        return conv;
      });

      // Sort by updated_at descending
      updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      return {
        conversations: updated,
        activeConversation:
          isCurrentActive && active
            ? { ...active, lastMessage, updated_at: updatedAt || new Date().toISOString() }
            : active,
      };
    });
  },

  clearUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ),
    }));
  },
}));
