import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
};

/**
 * Resolves the backend API base URL with full Android native WebView and Web support.
 */
export const getApiUrl = () => {
  // Check build-time environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  // Check runtime user/settings override (convenient for testing or pointing native APK to custom backend)
  if (typeof localStorage !== 'undefined') {
    const customUrl = localStorage.getItem('halalchat_server_url');
    if (customUrl) {
      return customUrl.replace(/\/$/, '');
    }
  }

  // When running inside Android/Capacitor WebView
  if (isNativePlatform()) {
    if (import.meta.env.DEV) {
      // Android emulator loopback to host computer
      return 'http://10.0.2.2:5001';
    }
    // Default to localhost for development runs, or server endpoint
    return 'http://localhost:5001';
  }

  // Web browser development mode
  if (import.meta.env.DEV) {
    return 'http://localhost:5001';
  }

  // Web production: relative root, proxied by reverse proxy / Vercel
  return '';
};

/**
 * Resolves the Socket.IO server URL.
 */
export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.replace(/\/$/, '');
  }

  const apiUrl = getApiUrl();
  if (isNativePlatform()) {
    return apiUrl;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:5001';
  }

  return window.location.origin;
};
