import React from 'react';
import ConversationItem from './ConversationItem';
import { MessageSquarePlus } from 'lucide-react';

const ConversationList = ({
  conversations,
  activeConversation,
  onSelectConversation,
  searchQuery,
  onOpenNewChat,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const safeConversations = Array.isArray(conversations) ? conversations : [];
  const filtered = safeConversations.filter((c) => {
    if (!c || !c.id) return false;
    if (!searchQuery) return true;
    const titleMatch = c.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const lastMsgMatch = c.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || lastMsgMatch;
  });

  if (isLoading && safeConversations.length === 0) {
    return <div className="conversation-list" role="status" style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading conversations...</div>;
  }

  if (error && safeConversations.length === 0) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }} role="alert">
        <p>{error}</p>
        <button onClick={onRetry} className="auth-btn" style={{ marginTop: 0 }}>Try again</button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ marginBottom: '14px', fontSize: '0.9rem' }}>
          {searchQuery ? 'No conversations match your search.' : 'No conversations yet.'}
        </p>
        <button
          onClick={onOpenNewChat}
          className="auth-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            padding: '8px 16px',
            marginTop: 0,
          }}
        >
          <MessageSquarePlus size={16} />
          Start a Chat
        </button>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {filtered.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isSelected={activeConversation?.id === conv.id}
          onClick={() => onSelectConversation(conv)}
        />
      ))}
    </div>
  );
};

export default ConversationList;
