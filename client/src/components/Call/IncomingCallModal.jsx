import React from 'react';
import { Phone, PhoneOff, Video, Mic } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

const IncomingCallModal = () => {
  const callState = useCallStore((s) => s.callState);
  const peer = useCallStore((s) => s.peer);
  const callType = useCallStore((s) => s.callType);
  const acceptCall = useCallStore((s) => s.acceptCall);
  const rejectCall = useCallStore((s) => s.rejectCall);

  if (callState !== 'INCOMING_RINGING') return null;

  const isVideo = callType === 'video';
  const avatarUrl =
    peer?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(peer?.username || 'user')}`;

  return (
    <div className="modal-overlay" style={{ zIndex: 120 }}>
      <div className="modal-content call-incoming-dialog">
        <div className="incoming-call-badge">
          {isVideo ? <Video size={14} /> : <Phone size={14} />}
          <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>

        <div className="incoming-avatar-container">
          <div className="pulse-ring ring-1" />
          <div className="pulse-ring ring-2" />
          <img src={avatarUrl} alt={peer?.username || 'Caller'} className="incoming-avatar-img" />
        </div>

        <h3 className="incoming-caller-name">{peer?.username || 'Caller'}</h3>
        <p className="incoming-call-subtitle">
          {isVideo ? 'wants to start a video call with you' : 'is calling you...'}
        </p>

        <div className="incoming-actions">
          <button
            type="button"
            className="call-action-btn decline-btn"
            onClick={() => rejectCall('Call declined by recipient')}
            title="Decline Call"
          >
            <PhoneOff size={22} />
            <span>Decline</span>
          </button>

          <button
            type="button"
            className="call-action-btn accept-btn"
            onClick={acceptCall}
            title="Accept Call"
          >
            {isVideo ? <Video size={22} /> : <Phone size={22} />}
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
