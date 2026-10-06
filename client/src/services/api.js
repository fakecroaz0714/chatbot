import axios from 'axios';
import { getApiUrl } from '../utils/config';

const api = axios.create({
  baseURL: `${getApiUrl()}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dynamically refresh baseURL before request to support runtime URL changes
api.interceptors.request.use((config) => {
  const currentBase = `${getApiUrl()}/api`;
  if (config.baseURL !== currentBase) {
    config.baseURL = currentBase;
  }
  return config;
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or invalid
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
