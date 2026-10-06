import { create } from 'zustand';
import api from '../services/api';
import { disconnectSocket } from '../services/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: Boolean(localStorage.getItem('token')),
  isLoading: false,
  error: null,

  login: async (loginId, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { loginId, password });
      const { user, token } = response.data;

      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', { username, email, password });
      const { user, token } = response.data;

      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  fetchMe: async () => {
    const token = get().token;
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      set({ isLoading: true });
      const response = await api.get('/auth/me');
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    disconnectSocket();
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
