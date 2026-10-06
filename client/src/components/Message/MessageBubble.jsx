import React from 'react';
import { Check, CheckCheck, FileText, Download } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const MessageBubble = ({ message, isGroup }) => {
  const currentUser = useAuthStore((s) => s.user);
  const isSelf = currentUser?.id === message.sender_id;

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderMedia = () => {
    if (!message.file_url) return null;

    if (message.message_type === 'IMAGE') {
      return (
        <a href={message.file_url} target="_blank" rel="noopener noreferrer">
          <img
            src={message.file_url}
            alt={message.file_name || 'Attached image'}
            className="message-image"
            loading="lazy"
          />
        </a>
      );
    }

    if (message.message_type === 'VIDEO') {
      return (
        <video
          src={message.file_url}
          controls
          className="message-image"
          style={{ maxHeight: '240px', background: '#000' }}
        />
      );
    }

    if (message.message_type === 'AUDIO') {
      return (
        <div style={{ marginTop: '6px', minWidth: '220px' }}>
          <audio src={message.file_url} controls style={{ width: '100%', height: '36px' }} />
        </div>
      );
    }

    // Default: Generic File attachment card
    return (
      <a
        href={message.file_url}
        download={message.file_name || 'download'}
        target="_blank"
        rel="noopener noreferrer"
        className="message-file-card"
      >
        <div className="file-icon-box">
          <FileText size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {message.file_name || 'Attachment'}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            {formatFileSize(message.file_size)}
          </div>
        </div>
        <Download size={16} style={{ opacity: 0.7 }} />
      </a>
    );
  };

  return (
    <div className={`message-row ${isSelf ? 'self' : 'other'}`}>
      {!isSelf && (
        <div className="avatar-wrapper" style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
          <img
            src={
              message.sender?.avatar_url ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${message.sender?.username || 'user'}`
            }
            alt="sender"
            className="avatar-img"
            style={{ width: '28px', height: '28px' }}
          />
        </div>
      )}

      <div className="message-bubble">
        {isGroup && !isSelf && (
          <div className="message-sender-name">{message.sender?.username}</div>
        )}

        {renderMedia()}

        {message.content && (
          <div style={{ marginTop: message.file_url ? '6px' : 0 }}>{message.content}</div>
        )}

        <div className="message-footer">
          <span>{formatTime(message.created_at)}</span>

          {/* Section 12: Read receipts for sender (✓ sent, ✓✓ read) */}
          {isSelf && (
            <span
              className={`read-status-icon ${message.isRead ? 'read' : ''}`}
              title={message.isRead ? 'Read' : 'Delivered'}
            >
              {message.isRead ? <CheckCheck size={14} /> : <Check size={14} />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
