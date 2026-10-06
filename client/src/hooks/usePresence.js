import { usePresenceStore } from '../store/presenceStore';

export const usePresence = (userId) => {
  const isOnline = usePresenceStore((state) => (userId ? state.isOnline(userId) : false));
  return { isOnline };
};
