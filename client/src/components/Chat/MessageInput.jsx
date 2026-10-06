import React, { useState, useRef } from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import FilePreview from '../FileUpload/FilePreview';

const MessageInput = () => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const { sendMessage, uploadAndSendFile, handleTyping, stopTypingNow } = useChat();

  const handleTextChange = (e) => {
    setContent(e.target.value);
    handleTyping();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmedContent = content.trim();
    if (!trimmedContent && !selectedFile) return;

    setIsSubmitting(true);
    stopTypingNow();

    try {
      if (selectedFile) {
        await uploadAndSendFile(selectedFile, trimmedContent);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await sendMessage(trimmedContent);
      }
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to submit message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="message-input-container">
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          onRemove={() => {
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}

      <form onSubmit={handleSubmit} className="input-box-wrapper">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="icon-btn"
          title="Attach file or image"
          disabled={isSubmitting}
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          value={content}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="input-textarea"
          disabled={isSubmitting}
        />

        <button
          type="submit"
          className="send-btn"
          disabled={(!content.trim() && !selectedFile) || isSubmitting}
          title="Send message"
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
