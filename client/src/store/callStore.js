import { create } from 'zustand';
import { getSocket } from '../services/socket';
import { webrtcService } from '../services/webrtcService';
import {
  playIncomingRingtone,
  playOutgoingRingback,
  playCallEndTone,
  stopAllCallSounds,
} from '../services/soundService';

let durationTimer = null;

export const useCallStore = create((set, get) => ({
  callState: 'IDLE', // IDLE | OUTGOING_RINGING | INCOMING_RINGING | CONNECTING | CONNECTED | ENDED
  callId: null,
  callType: 'video', // 'video' | 'voice'
  peer: null, // { id, username, avatar_url }
  conversationId: null,
  isCaller: false,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  callDuration: 0,
  stats: null,
  alert: null, // { type, message }

  // Set friendly alert notification
  showAlert: (message, type = 'info') => {
    set({ alert: { message, type } });
    setTimeout(() => {
      const current = get().alert;
      if (current && current.message === message) {
        set({ alert: null });
      }
    }, 4500);
  },

  clearAlert: () => set({ alert: null }),

  // 1. Caller starts outgoing call
  startCall: async ({ targetUserId, conversationId, type = 'video', targetUser }) => {
    const state = get();
    if (state.callState !== 'IDLE') {
      get().showAlert('You are already in an active call.', 'warning');
      return;
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      get().showAlert('Not connected to the server. Please reconnect.', 'error');
      return;
    }

    // Attempt to acquire media first (ensures permissions before ringing peer)
    let stream;
    try {
      stream = await webrtcService.getLocalMedia(type);
    } catch (err) {
      console.error('[Call] Media acquisition failed:', err);
      get().showAlert(err.message, 'error');
      return;
    }

    playOutgoingRingback();

    set({
      callState: 'OUTGOING_RINGING',
      callType: type,
      peer: targetUser || { id: targetUserId, username: 'Connecting...' },
      conversationId: conversationId || null,
      isCaller: true,
      localStream: stream,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
      callDuration: 0,
      stats: null,
    });

    socket.emit(
      'call:initiate',
      {
        targetUserId,
        conversationId,
        type,
      },
      (response) => {
        if (!response) return;

        if (response.status === 'error') {
          stopAllCallSounds();
          webrtcService.cleanup();
          set({ callState: 'IDLE', localStream: null, remoteStream: null });
          get().showAlert(response.error || 'Failed to initiate call', 'error');
        } else if (response.status === 'busy') {
          stopAllCallSounds();
          webrtcService.cleanup();
          set({ callState: 'IDLE', localStream: null, remoteStream: null });
          get().showAlert(response.reason || 'User is currently busy in another call.', 'warning');
        } else if (response.status === 'unavailable') {
          stopAllCallSounds();
          webrtcService.cleanup();
          set({ callState: 'IDLE', localStream: null, remoteStream: null });
          get().showAlert(response.reason || 'User is currently offline.', 'info');
        } else if (response.status === 'ringing') {
          set({ callId: response.callId });
        }
      }
    );
  },

  // 2. Incoming call received by recipient
  receiveIncomingCall: ({ callId, caller, type, conversationId }) => {
    const state = get();
    const socket = getSocket();

    // If already in call, reject as busy
    if (state.callState !== 'IDLE') {
      if (socket) {
        socket.emit('call:reject', { callId, reason: 'Recipient is busy in another call' });
      }
      return;
    }

    playIncomingRingtone();

    set({
      callState: 'INCOMING_RINGING',
      callId,
      peer: caller,
      callType: type || 'video',
      conversationId: conversationId || null,
      isCaller: false,
      callDuration: 0,
      stats: null,
    });
  },

  // 3. Callee accepts incoming call
  acceptCall: async () => {
    const state = get();
    stopAllCallSounds();

    if (state.callState !== 'INCOMING_RINGING' || !state.callId) return;

    const socket = getSocket();
    if (!socket || !socket.connected) {
      get().showAlert('Connection lost. Cannot answer call.', 'error');
      get().resetCallState();
      return;
    }

    // Acquire media
    let stream;
    try {
      stream = await webrtcService.getLocalMedia(state.callType);
    } catch (err) {
      console.error('[Call] Failed to acquire media on answer:', err);
      get().showAlert(err.message, 'error');
      socket.emit('call:reject', {
        callId: state.callId,
        reason: 'Media permission denied by callee',
      });
      get().resetCallState();
      return;
    }

    set({
      callState: 'CONNECTING',
      localStream: stream,
    });

    // Initialize WebRTC peer connection
    webrtcService.initPeerConnection({
      onIceCandidate: (candidate) => {
        socket.emit('call:ice-candidate', { callId: state.callId, candidate });
      },
      onRemoteStream: (remStream) => {
        set({ remoteStream: remStream });
      },
      onConnectionState: (connState) => {
        if (connState === 'connected') {
          get().startDurationTimer();
          set({ callState: 'CONNECTED' });
        } else if (connState === 'failed' || connState === 'disconnected') {
          get().showAlert('Connection interrupted. Retrying...', 'warning');
        }
      },
      onStats: (statsData) => {
        set({ stats: statsData });
      },
    });

    // Send accept signal to server
    socket.emit('call:accept', { callId: state.callId }, (res) => {
      if (res?.status === 'error') {
        get().showAlert(res.error || 'Failed to connect call', 'error');
        get().resetCallState();
      }
    });
  },

  // 4. Callee declines incoming call
  rejectCall: (reason = 'Call declined') => {
    stopAllCallSounds();
    const state = get();
    const socket = getSocket();

    if (state.callId && socket) {
      socket.emit('call:reject', { callId: state.callId, reason });
    }

    get().resetCallState();
  },

  // 5. Caller cancels outgoing call
  cancelOutgoingCall: () => {
    stopAllCallSounds();
    const state = get();
    const socket = getSocket();

    if (state.callId && socket) {
      socket.emit('call:reject', { callId: state.callId, reason: 'Caller cancelled' });
    }

    webrtcService.cleanup();
    get().resetCallState();
  },

  // 6. Either party hangs up active call
  endCall: (reason = 'Call ended') => {
    stopAllCallSounds();
    playCallEndTone();

    const state = get();
    const socket = getSocket();

    if (state.callId && socket) {
      socket.emit('call:end', { callId: state.callId, reason });
    }

    webrtcService.cleanup();
    get().resetCallState();
  },

  // 7. Called when peer ends or rejects
  handleRemoteEnd: (reason = 'Call ended') => {
    stopAllCallSounds();
    playCallEndTone();
    webrtcService.cleanup();
    get().resetCallState();
    get().showAlert(reason, 'info');
  },

  // 8. Duration timer management
  startDurationTimer: () => {
    if (durationTimer) clearInterval(durationTimer);
    set({ callDuration: 0 });
    durationTimer = setInterval(() => {
      set((s) => ({ callDuration: s.callDuration + 1 }));
    }, 1000);
  },

  stopDurationTimer: () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
  },

  // 9. Controls: Toggle Audio & Video
  toggleMute: () => {
    const next = !get().isMuted;
    webrtcService.toggleAudio(!next);
    set({ isMuted: next });
  },

  toggleVideo: () => {
    const next = !get().isVideoOff;
    webrtcService.toggleVideo(!next);
    set({ isVideoOff: next });
  },

  // Reset all call state
  resetCallState: () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
    set({
      callState: 'IDLE',
      callId: null,
      peer: null,
      conversationId: null,
      isCaller: false,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
      callDuration: 0,
      stats: null,
    });
  },
}));
