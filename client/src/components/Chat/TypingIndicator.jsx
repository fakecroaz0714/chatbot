import React from 'react';
import { useSocketStore } from '../../store/socketStore';
import { useAuthStore } from '../../store/authStore';

const EMPTY_TYPING_MAP = Object.freeze({});

const TypingIndicator = ({ conversationId }) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const typingMap = useSocketStore(
    (s) => s.typingMap[conversationId] || EMPTY_TYPING_MAP
  );

  // Filter out self
  const typers = Object.entries(typingMap)
    .filter(([uid]) => uid !== currentUserId)
    .map(([, val]) => val.username);

  if (typers.length === 0) {
    return <div className="typing-indicator-bar" />;
  }

  let text = '';
  if (typers.length === 1) {
    text = `${typers[0]} is typing...`;
  } else if (typers.length === 2) {
    text = `${typers[0]} and ${typers[1]} are typing...`;
  } else {
    text = `${typers[0]} and ${typers.length - 1} others are typing...`;
  }

  return (
    <div className="typing-indicator-bar">
      <div className="typing-dots">
        <span />
        <span />
        <span />
      </div>
      <span>{text}</span>
    </div>
  );
};

export default TypingIndicator;
