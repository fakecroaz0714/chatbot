import React from 'react';
import { ArrowLeft, Users, MoreVertical, Phone, Video } from 'lucide-react';
import { usePresence } from '../../hooks/usePresence';

const ChatHeader = ({ conversation, onBack }) => {
  const otherUserId = conversation?.type === 'DIRECT' ? conversation.otherUser?.id : null;
  const { isOnline } = usePresence(otherUserId);

  if (!conversation) return null;

  const avatarUrl =
    conversation.avatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(conversation.title || 'chat')}`;

  const renderStatus = () => {
    if (conversation.type === 'GROUP') {
      return `${conversation.members?.length || 0} members`;
    }
    return isOnline ? 'Online' : 'Offline';
  };

  return (
    <div className="chat-header">
      <div className="chat-header-left">
        <button onClick={onBack} className="icon-btn mobile-back-btn" title="Back to chats">
          <ArrowLeft size={20} />
        </button>

        <div className="avatar-wrapper">
          <img src={avatarUrl} alt={conversation.title} className="avatar-img" />
          {conversation.type === 'DIRECT' && (
            <span className={`status-badge ${isOnline ? 'online' : 'offline'}`} />
          )}
        </div>

        <div>
          <div className="chat-header-title">{conversation.title}</div>
          <div className="chat-header-status">
            {conversation.type === 'DIRECT' && (
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            )}
            {conversation.type === 'GROUP' && <Users size={12} />}
            <span>{renderStatus()}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="icon-btn" title="Voice call (simulated)">
          <Phone size={18} />
        </button>
        <button className="icon-btn" title="Video call (simulated)">
          <Video size={18} />
        </button>
        <button className="icon-btn" title="Conversation info">
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
