import React, { useState, useEffect } from 'react';
import { X, Search, MessageSquare, UserCheck } from 'lucide-react';
import api from '../../services/api';
import { useConversationStore } from '../../store/conversationStore';
import StatusBadge from '../Presence/StatusBadge';
import { usePresence } from '../../hooks/usePresence';

const UserRow = ({ user, onStartChat }) => {
  const { isOnline } = usePresence(user.id);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        marginBottom: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="avatar-wrapper">
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
            alt={user.username}
            className="avatar-img"
            style={{ width: '40px', height: '40px' }}
          />
          <StatusBadge isOnline={isOnline} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.username}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</div>
        </div>
      </div>

      <button
        onClick={() => onStartChat(user.id)}
        className="icon-btn"
        title="Start Chat"
        style={{
          background: 'var(--accent-primary)',
          color: 'white',
          width: '34px',
          height: '34px',
        }}
      >
        <MessageSquare size={16} />
      </button>
    </div>
  );
};

const UserSearchModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const addOrSelectConversation = useConversationStore((s) => s.addOrSelectConversation);

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users?search=${encodeURIComponent(searchTerm)}`);
        setUsers(res.data.users || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(fetchUsers, 250);
    return () => clearTimeout(delay);
  }, [searchTerm, isOpen]);

  const handleStartChat = async (recipientId) => {
    try {
      const res = await api.post('/conversations', {
        recipientId,
        type: 'DIRECT',
      });
      const conv = res.data.conversation;
      addOrSelectConversation(conv);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Start a Conversation</h3>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px 0 20px' }}>
          <div className="search-input-wrapper">
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              Searching users...
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No other users found. Register another account or test with demo users!
            </div>
          ) : (
            users.map((u) => (
              <UserRow key={u.id} user={u} onStartChat={handleStartChat} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;
