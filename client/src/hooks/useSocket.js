import { useEffect } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { usePresenceStore } from '../store/presenceStore';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import { useCallStore } from '../store/callStore';
import { webrtcService } from '../services/webrtcService';
import { stopAllCallSounds } from '../services/soundService';

export const useSocket = () => {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);

  const setIsConnected = useSocketStore((s) => s.setIsConnected);
  const setTyping = useSocketStore((s) => s.setTyping);
  const removeTyping = useSocketStore((s) => s.removeTyping);

  const setUserOnline = usePresenceStore((s) => s.setUserOnline);
  const setUserOffline = usePresenceStore((s) => s.setUserOffline);
  const setAllOnlineUsers = usePresenceStore((s) => s.setAllOnlineUsers);

  const activeConversation = useConversationStore((s) => s.activeConversation);
  const updateConversationLastMessage = useConversationStore(
    (s) => s.updateConversationLastMessage
  );

  const addMessage = useMessageStore((s) => s.addMessage);
  const updateReceipt = useMessageStore((s) => s.updateReceipt);
  const bulkUpdateReceipts = useMessageStore((s) => s.bulkUpdateReceipts);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(token);

    socket.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', socket.id);
      setIsConnected(true);

      // Query initial online users
      socket.emit('presence:get', (response) => {
        if (response && response.onlineUsers) {
          setAllOnlineUsers(response.onlineUsers);
        }
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', reason);
      setIsConnected(false);
    });

    // Presence events
    socket.on('user:online', (data) => {
      if (data && data.userId) {
        setUserOnline(data.userId);
      }
    });

    socket.on('user:offline', (data) => {
      if (data && data.userId) {
        setUserOffline(data.userId);
      }
    });

    socket.on('presence:update', (data) => {
      if (data && data.onlineUsers) {
        setAllOnlineUsers(data.onlineUsers);
      }
    });

    // Real-time messages (Section 8 & 9)
    socket.on('message:new', (newMsg) => {
      const currentActiveId = useConversationStore.getState().activeConversation?.id;

      if (currentActiveId === newMsg.conversation_id) {
        addMessage(newMsg);

        // Mark as read immediately if viewer is recipient
        if (currentUser && newMsg.sender_id !== currentUser.id) {
          socket.emit('message:read', {
            messageId: newMsg.id,
            conversationId: newMsg.conversation_id,
          });
        }
      }

      // Update sidebar preview
      updateConversationLastMessage(
        newMsg.conversation_id,
        {
          id: newMsg.id,
          content: newMsg.content,
          message_type: newMsg.message_type,
          sender_id: newMsg.sender_id,
          sender_username: newMsg.sender?.username || 'User',
          created_at: newMsg.created_at,
        },
        newMsg.created_at
      );
    });

    // Sidebar update for members not in room
    socket.on('conversation:updated', (data) => {
      updateConversationLastMessage(data.conversationId, data.lastMessage, data.updated_at);
    });

    // Typing indicators (Section 11)
    socket.on('typing:start', (data) => {
      setTyping(data.conversationId, data.userId, data.username);
    });

    socket.on('typing:stop', (data) => {
      removeTyping(data.conversationId, data.userId);
    });

    // Read receipts (Section 12)
    socket.on('message:read:update', (data) => {
      updateReceipt(data.messageId, data.userId, data.readAt);
    });

    socket.on('message:read:bulk_update', (data) => {
      bulkUpdateReceipts(data.messageIds, data.userId, data.readAt);
    });

    // WebRTC Calling Signaling Events
    socket.on('call:incoming', (data) => {
      useCallStore.getState().receiveIncomingCall(data);
    });

    socket.on('call:accepted', async (data) => {
      const callStore = useCallStore.getState();
      stopAllCallSounds();
      useCallStore.setState({ callState: 'CONNECTING' });

      try {
        webrtcService.initPeerConnection({
          onIceCandidate: (candidate) => {
            socket.emit('call:ice-candidate', { callId: data.callId, candidate });
          },
          onRemoteStream: (remStream) => {
            useCallStore.setState({ remoteStream: remStream });
          },
          onConnectionState: (connState) => {
            if (connState === 'connected') {
              useCallStore.getState().startDurationTimer();
              useCallStore.setState({ callState: 'CONNECTED' });
            } else if (connState === 'failed' || connState === 'disconnected') {
              useCallStore.getState().showAlert('Connection interrupted. Retrying...', 'warning');
            }
          },
          onStats: (statsData) => {
            useCallStore.setState({ stats: statsData });
          },
        });

        const offer = await webrtcService.createOffer();
        socket.emit('call:offer', { callId: data.callId, sdp: offer });
      } catch (err) {
        console.error('[WebRTC] Failed to send offer on call acceptance:', err);
        callStore.endCall('Failed to establish peer connection');
      }
    });

    socket.on('call:offer', async (data) => {
      try {
        const answer = await webrtcService.createAnswer(data.sdp);
        socket.emit('call:answer', { callId: data.callId, sdp: answer });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    socket.on('call:answer', async (data) => {
      try {
        await webrtcService.handleAnswer(data.sdp);
      } catch (err) {
        console.error('[WebRTC] Error handling answer:', err);
      }
    });

    socket.on('call:ice-candidate', async (data) => {
      try {
        await webrtcService.addIceCandidate(data.candidate);
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    });

    socket.on('call:rejected', (data) => {
      useCallStore.getState().handleRemoteEnd(data.reason || 'Call was declined');
    });

    socket.on('call:cancelled', () => {
      useCallStore.getState().handleRemoteEnd('Caller cancelled the call');
    });

    socket.on('call:busy', (data) => {
      useCallStore.getState().handleRemoteEnd(data.reason || 'User is busy in another call');
    });

    socket.on('call:unavailable', (data) => {
      useCallStore.getState().handleRemoteEnd(data.reason || 'User is currently offline');
    });

    socket.on('call:ended', (data) => {
      useCallStore.getState().handleRemoteEnd(data.reason || 'Call ended');
    });

    socket.on('call:error', (data) => {
      useCallStore.getState().showAlert(data.error || 'Call error', 'error');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('presence:update');
      socket.off('message:new');
      socket.off('conversation:updated');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('message:read:update');
      socket.off('message:read:bulk_update');
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:offer');
      socket.off('call:answer');
      socket.off('call:ice-candidate');
      socket.off('call:rejected');
      socket.off('call:cancelled');
      socket.off('call:busy');
      socket.off('call:unavailable');
      socket.off('call:ended');
      socket.off('call:error');
    };
  }, [token, isAuthenticated, currentUser?.id]);

  // When activeConversation changes, join its socket room and mark unread messages as read
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socket.connected || !activeConversation?.id) return;

    socket.emit('conversation:join', activeConversation.id);
    socket.emit('message:read', { conversationId: activeConversation.id });

    return () => {
      socket.emit('conversation:leave', activeConversation.id);
    };
  }, [activeConversation?.id]);
};
