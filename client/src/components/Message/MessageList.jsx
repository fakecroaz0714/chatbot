import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { useMessageStore } from '../../store/messageStore';

const MessageList = ({ conversation }) => {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const previousScrollHeightRef = useRef(0);

  const messages = useMessageStore((s) => s.messages);
  const isLoading = useMessageStore((s) => s.isLoading);
  const error = useMessageStore((s) => s.error);
  const isLoadingOlder = useMessageStore((s) => s.isLoadingOlder);
  const hasMore = useMessageStore((s) => s.hasMore);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const fetchOlderMessages = useMessageStore((s) => s.fetchOlderMessages);

  // Initial load when conversation changes
  useEffect(() => {
    if (conversation?.id) {
      fetchMessages(conversation.id);
    }
  }, [conversation?.id, fetchMessages]);

  // Maintain scroll position when older messages are prepended
  useEffect(() => {
    if (containerRef.current && previousScrollHeightRef.current > 0) {
      const currentHeight = containerRef.current.scrollHeight;
      const heightDifference = currentHeight - previousScrollHeightRef.current;
      containerRef.current.scrollTop += heightDifference;
      previousScrollHeightRef.current = 0;
    }
  }, [messages.length]);

  // Auto scroll to bottom when new messages arrive (at bottom)
  useEffect(() => {
    if (!isLoadingOlder && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoadingOlder]);

  const handleLoadOlder = () => {
    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
    }
    fetchOlderMessages();
  };

  const handleScroll = (e) => {
    // If scrolled to top and more messages exist, automatically fetch older
    if (e.target.scrollTop === 0 && hasMore && !isLoadingOlder) {
      handleLoadOlder();
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          gap: '8px',
        }}
      >
        <Loader2 size={24} className="animate-spin" />
        <span>Loading message history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="message-list-container"
        role="alert"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}
      >
        <span>{error}</span>
        <button className="load-more-btn" onClick={() => fetchMessages(conversation.id)}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="message-list-container"
    >
      {hasMore && (
        <button
          onClick={handleLoadOlder}
          disabled={isLoadingOlder}
          className="load-more-btn"
        >
          {isLoadingOlder ? 'Loading older messages...' : '↑ Load older messages'}
        </button>
      )}

      {messages.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}
        >
          This is the beginning of your conversation with {conversation?.title || 'this chat'}.
          <br />
          Say hello! 👋
        </div>
      ) : (
        messages.map((msg) => (
          <MessageBubble
            key={msg.id || msg.clientTempId}
            message={msg}
            isGroup={conversation.type === 'GROUP'}
          />
        ))
      )}

      <div ref={bottomRef} style={{ height: '1px' }} />
    </div>
  );
};

export default MessageList;
