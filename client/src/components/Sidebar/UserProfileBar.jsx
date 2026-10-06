import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import StatusBadge from '../Presence/StatusBadge';

const UserProfileBar = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  return (
    <div className="user-profile-bar">
      <div className="user-profile-info">
        <div className="avatar-wrapper">
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
            alt={user.username}
            className="avatar-img"
            style={{ width: '38px', height: '38px' }}
          />
          <StatusBadge isOnline={true} />
        </div>
        <div>
          <div className="user-profile-name">{user.username}</div>
          <div className="user-profile-status">
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-online)',
              }}
            />
            Connected
          </div>
        </div>
      </div>
      <button
        onClick={logout}
        className="icon-btn"
        title="Sign Out"
        style={{ color: '#f87171' }}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
};

export default UserProfileBar;
