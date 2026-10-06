import React from 'react';
import { MessageSquare, Shield, Zap, Sparkles } from 'lucide-react';
import ChatHeader from './ChatHeader';
import MessageList from '../Message/MessageList';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import { useConversationStore } from '../../store/conversationStore';

const ChatWindow = ({ onOpenSidebar }) => {
  const activeConversation = useConversationStore((s) => s.activeConversation);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);

  if (!activeConversation) {
    return (
      <div className="chat-window">
        <div className="empty-chat">
          <div className="empty-chat-icon">
            <MessageSquare size={40} />
          </div>
          <h2>Welcome to PulseChat</h2>
          <p>
            An event-driven real-time messaging platform powered by Socket.IO, Redis presence,
            PostgreSQL persistence, and S3 file sharing.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '28px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="var(--accent-primary)" />
              <span>Instant Events</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} color="var(--status-online)" />
              <span>JWT & Role Security</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--accent-secondary)" />
              <span>Typing & Read Receipts</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <ChatHeader
        conversation={activeConversation}
        onBack={() => {
          setActiveConversation(null);
          if (onOpenSidebar) onOpenSidebar();
        }}
      />

      <MessageList conversation={activeConversation} />

      <TypingIndicator conversationId={activeConversation.id} />

      <MessageInput />
    </div>
  );
};

export default ChatWindow;
