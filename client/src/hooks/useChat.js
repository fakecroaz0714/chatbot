import { useRef, useCallback } from 'react';
import axios from 'axios';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useConversationStore } from '../store/conversationStore';

export const useChat = () => {
  const currentUser = useAuthStore((s) => s.user);
  const activeConversation = useConversationStore((s) => s.activeConversation);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  /**
   * Section 11: Debounced typing indicator
   */
  const handleTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !socket.connected || !activeConversation?.id) return;

    const conversationId = activeConversation.id;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { conversationId });
    }

    // Reset debounce timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing:stop', { conversationId });
    }, 2000);
  }, [activeConversation?.id]);

  const stopTypingNow = useCallback(() => {
    const socket = getSocket();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current && socket && socket.connected && activeConversation?.id) {
      isTypingRef.current = false;
      socket.emit('typing:stop', { conversationId: activeConversation.id });
    }
  }, [activeConversation?.id]);

  /**
   * Section 8: Send text message
   */
  const sendMessage = useCallback(
    async (content) => {
      const socket = getSocket();
      if (!socket || !socket.connected || !activeConversation?.id || !content.trim()) {
        return;
      }

      stopTypingNow();

      const clientTempId = 'temp-' + Date.now();

      socket.emit(
        'message:send',
        {
          conversationId: activeConversation.id,
          content: content.trim(),
          messageType: 'TEXT',
          clientTempId,
        },
        (response) => {
          if (response?.status === 'error') {
            console.error('Error sending message:', response.error);
          }
        }
      );
    },
    [activeConversation?.id, stopTypingNow]
  );

  /**
   * Section 13: File Sharing (Presigned URL direct to S3 or local upload fallback)
   */
  const uploadAndSendFile = useCallback(
    async (file, caption = '') => {
      const socket = getSocket();
      if (!socket || !socket.connected || !activeConversation?.id || !file) {
        return;
      }

      stopTypingNow();

      try {
        // Step 1: Request upload metadata/presigned URL from backend
        const presignRes = await api.post('/files/presigned-url', {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        });

        const { isS3, uploadUrl, fileUrl, messageType, fileName } = presignRes.data;

        let finalFileUrl = fileUrl;

        // Step 2: Upload file
        if (isS3) {
          // Direct browser-to-S3 upload
          await axios.put(uploadUrl, file, {
            headers: {
              'Content-Type': file.type,
            },
          });
        } else {
          // Local server fallback upload
          const formData = new FormData();
          formData.append('file', file);

          const localRes = await api.post('/files/upload-local', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          finalFileUrl = localRes.data.fileUrl;
        }

        // Step 3: Send file metadata through Socket.IO
        const clientTempId = 'temp-file-' + Date.now();
        socket.emit(
          'message:send',
          {
            conversationId: activeConversation.id,
            content: caption ? caption.trim() : null,
            messageType: messageType || 'FILE',
            fileUrl: finalFileUrl,
            fileName: file.name,
            fileSize: file.size,
            clientTempId,
          },
          (response) => {
            if (response?.status === 'error') {
              console.error('Error sending file message:', response.error);
            }
          }
        );
      } catch (err) {
        console.error('File upload failed:', err);
        throw err;
      }
    },
    [activeConversation?.id, stopTypingNow]
  );

  return {
    sendMessage,
    uploadAndSendFile,
    handleTyping,
    stopTypingNow,
  };
};
