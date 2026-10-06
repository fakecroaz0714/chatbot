import React from 'react';
import StatusBadge from '../Presence/StatusBadge';
import { usePresence } from '../../hooks/usePresence';
import { useConversationStore } from '../../store/conversationStore';

const ConversationItem = ({ conversation, isSelected, onClick }) => {
  const otherUserId = conversation.type === 'DIRECT' ? conversation.otherUser?.id : null;
  const { isOnline } = usePresence(otherUserId);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getPreviewText = () => {
    const msg = conversation.lastMessage;
    if (!msg) return 'No messages yet';

    let prefix = '';
    if (conversation.type === 'GROUP' && msg.sender_username) {
      prefix = `${msg.sender_username}: `;
    }

    if (msg.message_type === 'IMAGE') return `${prefix}📷 Photo`;
    if (msg.message_type === 'VIDEO') return `${prefix}🎥 Video`;
    if (msg.message_type === 'AUDIO') return `${prefix}🎵 Audio`;
    if (msg.message_type === 'FILE') return `${prefix}📎 Document`;
    return `${prefix}${msg.content || ''}`;
  };

  const avatarUrl =
    conversation.avatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(conversation.title || 'chat')}`;

  return (
    <button
      type="button"
      className={`conversation-item ${isSelected ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="avatar-wrapper">
        <img src={avatarUrl} alt={conversation.title} className="avatar-img" />
        {conversation.type === 'DIRECT' && <StatusBadge isOnline={isOnline} />}
      </div>

      <div className="conversation-info">
        <div className="conversation-top">
          <span className="conversation-title">{conversation.title}</span>
          <span className="conversation-time">
            {formatTime(conversation.lastMessage?.created_at || conversation.updated_at)}
          </span>
        </div>

        <div className="conversation-bottom">
          <span className="conversation-preview">{getPreviewText()}</span>
          {Boolean(conversation.unreadCount && conversation.unreadCount > 0) && (
            <span className="unread-badge">{conversation.unreadCount}</span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ConversationItem;
