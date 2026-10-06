import { randomUUID } from 'crypto';
import prisma from '../db/prisma.js';

// In-memory call session stores
// activeCalls: callId -> CallSession
const activeCalls = new Map();
// userActiveCalls: userId -> callId
const userActiveCalls = new Map();

/**
 * Clean up a call session and remove user tracking
 */
export const cleanupCallSession = (callId) => {
  const call = activeCalls.get(callId);
  if (!call) return null;

  activeCalls.delete(callId);
  userActiveCalls.delete(call.callerId);
  userActiveCalls.delete(call.calleeId);
  return call;
};

/**
 * Check if a user is currently engaged in a call
 */
export const isUserInCall = (userId) => {
  return userActiveCalls.has(userId);
};

/**
 * Register call signaling event handlers on a socket connection
 */
export const registerCallHandlers = (io, socket) => {
  const user = socket.user;

  // 1. Initiate Call
  socket.on('call:initiate', async ({ targetUserId, conversationId, type = 'video' }, callback) => {
    try {
      const ack = typeof callback === 'function' ? callback : () => {};

      if (!targetUserId || typeof targetUserId !== 'string') {
        const err = { error: 'Invalid target user ID' };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      if (targetUserId === user.id) {
        const err = { error: 'You cannot call yourself' };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      const callType = type === 'voice' ? 'voice' : 'video';

      // Check if caller is already in a call
      if (userActiveCalls.has(user.id)) {
        const existingCallId = userActiveCalls.get(user.id);
        const err = { error: 'You are already in an active call', callId: existingCallId };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      // Check if callee is in another call
      if (userActiveCalls.has(targetUserId)) {
        const busyPayload = {
          targetUserId,
          reason: 'User is busy in another call',
        };
        socket.emit('call:busy', busyPayload);
        return ack({ status: 'busy', ...busyPayload });
      }

      // Verify callee is online (has active socket connections)
      const calleeRoom = io.sockets.adapter.rooms.get(`user:${targetUserId}`);
      if (!calleeRoom || calleeRoom.size === 0) {
        const unavailPayload = {
          targetUserId,
          reason: 'User is currently offline and unavailable for calls',
        };
        socket.emit('call:unavailable', unavailPayload);
        return ack({ status: 'unavailable', ...unavailPayload });
      }

      // Authorization / recipient existence check in database
      const recipient = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, username: true, avatar_url: true },
      });

      if (!recipient) {
        const err = { error: 'User does not exist' };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      // If conversationId provided, verify membership
      if (conversationId) {
        const isMember = await prisma.conversationMember.findFirst({
          where: {
            conversation_id: conversationId,
            user_id: user.id,
          },
        });
        if (!isMember) {
          const err = { error: 'You are not authorized for this conversation' };
          socket.emit('call:error', err);
          return ack({ status: 'error', ...err });
        }
      }

      const callId = randomUUID();
      const callSession = {
        id: callId,
        callerId: user.id,
        calleeId: targetUserId,
        callerSocketId: socket.id,
        calleeSocketId: null,
        conversationId: conversationId || null,
        type: callType,
        status: 'ringing',
        startedAt: Date.now(),
        connectedAt: null,
      };

      activeCalls.set(callId, callSession);
      userActiveCalls.set(user.id, callId);
      userActiveCalls.set(targetUserId, callId);

      // Emit incoming call event to recipient's room
      io.to(`user:${targetUserId}`).emit('call:incoming', {
        callId,
        type: callType,
        conversationId: conversationId || null,
        caller: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
        },
      });

      // Confirm to caller that recipient is ringing
      const ringingData = {
        callId,
        targetUserId,
        type: callType,
        targetUser: recipient,
      };
      socket.emit('call:ringing', ringingData);
      ack({ status: 'ringing', ...ringingData });
    } catch (err) {
      console.error('[Call] Error initiating call:', err);
      socket.emit('call:error', { error: 'Internal error initiating call' });
    }
  });

  // 2. Accept Call
  socket.on('call:accept', ({ callId }, callback) => {
    try {
      const ack = typeof callback === 'function' ? callback : () => {};
      const call = activeCalls.get(callId);

      if (!call) {
        const err = { error: 'Call session not found or already ended' };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      // Security check: only the designated callee can accept
      if (call.calleeId !== user.id) {
        const err = { error: 'Unauthorized to accept this call' };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      if (call.status !== 'ringing') {
        const err = { error: `Call cannot be accepted in state: ${call.status}` };
        socket.emit('call:error', err);
        return ack({ status: 'error', ...err });
      }

      call.status = 'connected';
      call.connectedAt = Date.now();
      call.calleeSocketId = socket.id;

      // Notify caller that call was accepted
      io.to(`user:${call.callerId}`).emit('call:accepted', {
        callId,
        type: call.type,
        callee: {
          id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
        },
      });

      // Notify callee that connection is ready
      socket.emit('call:connected', {
        callId,
        type: call.type,
      });

      ack({ status: 'connected', callId });
    } catch (err) {
      console.error('[Call] Error accepting call:', err);
      socket.emit('call:error', { error: 'Internal error accepting call' });
    }
  });

  // 3. Reject / Cancel Call
  socket.on('call:reject', ({ callId, reason }) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) return;

      // Must be participant
      if (call.callerId !== user.id && call.calleeId !== user.id) return;

      cleanupCallSession(callId);

      if (user.id === call.callerId) {
        // Caller canceled before answer
        io.to(`user:${call.calleeId}`).emit('call:cancelled', {
          callId,
          reason: reason || 'Caller cancelled the call',
        });
      } else {
        // Callee declined
        io.to(`user:${call.callerId}`).emit('call:rejected', {
          callId,
          reason: reason || 'Call declined',
        });
      }
    } catch (err) {
      console.error('[Call] Error rejecting call:', err);
    }
  });

  // 4. WebRTC Offer
  socket.on('call:offer', ({ callId, sdp }) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) return;

      // Verify authorization
      if (call.callerId !== user.id && call.calleeId !== user.id) return;

      if (!sdp || typeof sdp !== 'object' || sdp.type !== 'offer' || typeof sdp.sdp !== 'string') {
        socket.emit('call:error', { error: 'Invalid SDP offer format' });
        return;
      }

      const peerId = user.id === call.callerId ? call.calleeId : call.callerId;
      io.to(`user:${peerId}`).emit('call:offer', {
        callId,
        sdp,
        senderId: user.id,
      });
    } catch (err) {
      console.error('[Call] Error routing offer:', err);
    }
  });

  // 5. WebRTC Answer
  socket.on('call:answer', ({ callId, sdp }) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) return;

      // Verify authorization
      if (call.callerId !== user.id && call.calleeId !== user.id) return;

      if (!sdp || typeof sdp !== 'object' || sdp.type !== 'answer' || typeof sdp.sdp !== 'string') {
        socket.emit('call:error', { error: 'Invalid SDP answer format' });
        return;
      }

      const peerId = user.id === call.callerId ? call.calleeId : call.callerId;
      io.to(`user:${peerId}`).emit('call:answer', {
        callId,
        sdp,
        senderId: user.id,
      });
    } catch (err) {
      console.error('[Call] Error routing answer:', err);
    }
  });

  // 6. ICE Candidate
  socket.on('call:ice-candidate', ({ callId, candidate }) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) return;

      // Verify authorization
      if (call.callerId !== user.id && call.calleeId !== user.id) return;

      if (!candidate || typeof candidate !== 'object') {
        return;
      }

      const peerId = user.id === call.callerId ? call.calleeId : call.callerId;
      io.to(`user:${peerId}`).emit('call:ice-candidate', {
        callId,
        candidate,
        senderId: user.id,
      });
    } catch (err) {
      console.error('[Call] Error routing ICE candidate:', err);
    }
  });

  // 7. End Call
  socket.on('call:end', ({ callId, reason }) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) return;

      if (call.callerId !== user.id && call.calleeId !== user.id) return;

      const peerId = user.id === call.callerId ? call.calleeId : call.callerId;
      cleanupCallSession(callId);

      const endPayload = {
        callId,
        reason: reason || 'Call ended',
        endedBy: user.id,
      };

      io.to(`user:${peerId}`).emit('call:ended', endPayload);
      socket.emit('call:ended', endPayload);
    } catch (err) {
      console.error('[Call] Error ending call:', err);
    }
  });
};

/**
 * Handle disconnect cleanup for calling
 */
export const handleCallOnDisconnect = (io, socket) => {
  const user = socket.user;
  if (!user || !userActiveCalls.has(user.id)) return;

  // Check if user still has other open sockets
  const userRoom = io.sockets.adapter.rooms.get(`user:${user.id}`);
  if (userRoom && userRoom.size > 0) {
    // User still has another socket connected
    return;
  }

  const callId = userActiveCalls.get(user.id);
  const call = cleanupCallSession(callId);
  if (call) {
    const peerId = user.id === call.callerId ? call.calleeId : call.callerId;
    io.to(`user:${peerId}`).emit('call:ended', {
      callId,
      reason: 'Peer disconnected (connection dropped)',
      endedBy: user.id,
    });
  }
};
