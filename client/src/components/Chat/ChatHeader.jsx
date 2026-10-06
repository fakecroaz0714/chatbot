import React from 'react';
import { ArrowLeft, Users, MoreVertical, Phone, Video } from 'lucide-react';
import { usePresence } from '../../hooks/usePresence';
import { useCallStore } from '../../store/callStore';

const ChatHeader = ({ conversation, onBack }) => {
  const otherUserId = conversation?.type === 'DIRECT' ? conversation.otherUser?.id : null;
  const { isOnline } = usePresence(otherUserId);
  const startCall = useCallStore((s) => s.startCall);
  const callState = useCallStore((s) => s.callState);

  if (!conversation) return null;

  const isDirect = conversation.type === 'DIRECT' && conversation.otherUser;

  const handleStartCall = (type) => {
    if (!isDirect) return;
    startCall({
      targetUserId: conversation.otherUser.id,
      conversationId: conversation.id,
      type,
      targetUser: {
        id: conversation.otherUser.id,
        username: conversation.otherUser.username,
        avatar_url: conversation.otherUser.avatar_url,
      },
    });
  };

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
        <button
          className="icon-btn"
          onClick={() => handleStartCall('voice')}
          disabled={!isDirect || callState !== 'IDLE'}
          title={
            !isDirect
              ? 'Voice calls are available in 1-on-1 direct chats'
              : callState !== 'IDLE'
              ? 'Already in a call'
              : `Voice call ${conversation.otherUser?.username}`
          }
          style={{ opacity: !isDirect ? 0.45 : 1 }}
        >
          <Phone size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => handleStartCall('video')}
          disabled={!isDirect || callState !== 'IDLE'}
          title={
            !isDirect
              ? 'Video calls are available in 1-on-1 direct chats'
              : callState !== 'IDLE'
              ? 'Already in a call'
              : `Video call ${conversation.otherUser?.username} (targeting up to 1080p)`
          }
          style={{ opacity: !isDirect ? 0.45 : 1 }}
        >
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
