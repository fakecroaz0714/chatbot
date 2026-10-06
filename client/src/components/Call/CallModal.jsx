import React, { useEffect, useRef, useState } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Activity,
  Info,
  Wifi,
  Loader2,
} from 'lucide-react';
import { useCallStore } from '../../store/callStore';

const formatDuration = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const CallModal = () => {
  const callState = useCallStore((s) => s.callState);
  const callType = useCallStore((s) => s.callType);
  const peer = useCallStore((s) => s.peer);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const isMuted = useCallStore((s) => s.isMuted);
  const isVideoOff = useCallStore((s) => s.isVideoOff);
  const callDuration = useCallStore((s) => s.callDuration);
  const stats = useCallStore((s) => s.stats);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleVideo = useCallStore((s) => s.toggleVideo);
  const endCall = useCallStore((s) => s.endCall);
  const cancelOutgoingCall = useCallStore((s) => s.cancelOutgoingCall);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;

      const checkVideoTrack = () => {
        const videoTracks = remoteStream.getVideoTracks();
        setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      };

      checkVideoTrack();
      remoteStream.addEventListener('addtrack', checkVideoTrack);
      remoteStream.addEventListener('removetrack', checkVideoTrack);

      return () => {
        remoteStream.removeEventListener('addtrack', checkVideoTrack);
        remoteStream.removeEventListener('removetrack', checkVideoTrack);
      };
    }
  }, [remoteStream, callState]);

  // If not calling, return null
  if (
    callState !== 'OUTGOING_RINGING' &&
    callState !== 'CONNECTING' &&
    callState !== 'CONNECTED'
  ) {
    return null;
  }

  const isVideo = callType === 'video';
  const peerAvatar =
    peer?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(peer?.username || 'peer')}`;

  const renderQualityBadgeColor = () => {
    const q = stats?.quality || 'Good';
    if (q === 'Excellent' || q === 'Good') return '#10b981';
    if (q === 'Fair') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="call-modal-overlay">
      <div className="call-container-card">
        {/* Top Header Information Bar */}
        <div className="call-top-bar">
          <div className="call-peer-badge">
            <span
              className="call-status-indicator"
              style={{ backgroundColor: renderQualityBadgeColor() }}
            />
            <span className="call-peer-title">{peer?.username || 'Call Participant'}</span>
            <span className="call-time-badge">{formatDuration(callDuration)}</span>
          </div>

          {/* Honest Quality Information Pill */}
          <div className="call-quality-pill" onClick={() => setShowStatsModal(!showStatsModal)}>
            <Wifi size={14} style={{ color: renderQualityBadgeColor() }} />
            <span>
              {stats
                ? `${stats.quality} • ${stats.resolution} • ${stats.rtt}`
                : isVideo
                ? 'Targeting up to 1080p'
                : 'High-Quality Audio'}
            </span>
            <Info size={14} style={{ opacity: 0.7 }} />
          </div>
        </div>

        {/* Diagnostics & Honest Quality Popover */}
        {showStatsModal && (
          <div className="call-diagnostics-card">
            <div className="diag-header">
              <Activity size={16} color="var(--accent-primary)" />
              <h4>Live Media & Connection Diagnostics</h4>
            </div>
            <div className="diag-grid">
              <div className="diag-item">
                <span className="diag-label">Target Capability:</span>
                <span className="diag-value">Up to 1080p FHD (adaptive)</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Live Active Resolution:</span>
                <span className="diag-value">{stats?.resolution || (isVideo ? 'Adapting...' : 'Audio')}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Network Latency (RTT):</span>
                <span className="diag-value">{stats?.rtt || 'Analyzing...'}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Bitrate:</span>
                <span className="diag-value">{stats?.bitrate || 'Adapting...'}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Frame Rate:</span>
                <span className="diag-value">{stats?.fps || (isVideo ? '30 fps' : 'N/A')}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Packet Loss:</span>
                <span className="diag-value">{stats?.packetLoss || '0.0%'}</span>
              </div>
            </div>
            <p className="diag-note">
              Resolution and bitrate dynamically scale to your current network bandwidth and hardware.
            </p>
          </div>
        )}

        {/* Main Viewport Area */}
        <div className="call-viewport">
          {callState === 'OUTGOING_RINGING' && (
            <div className="calling-state-view">
              <div className="outgoing-avatar-ring">
                <div className="pulse-ring ring-1" />
                <div className="pulse-ring ring-2" />
                <img src={peerAvatar} alt={peer?.username} className="outgoing-avatar-img" />
              </div>
              <h3>Calling {peer?.username}...</h3>
              <p className="calling-state-hint">
                Waiting for recipient to accept ({isVideo ? 'Video' : 'Voice'} call)
              </p>
            </div>
          )}

          {callState === 'CONNECTING' && (
            <div className="calling-state-view">
              <div className="connecting-spinner">
                <Loader2 size={44} className="animate-spin" color="var(--accent-primary)" />
              </div>
              <h3>Connecting Media Session...</h3>
              <p className="calling-state-hint">Negotiating WebRTC peer-to-peer connection</p>
            </div>
          )}

          {callState === 'CONNECTED' && (
            <div className="connected-viewport">
              {isVideo && hasRemoteVideo ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="main-remote-video"
                />
              ) : (
                <div className="audio-call-stage">
                  <div className="audio-avatar-wrapper">
                    <img src={peerAvatar} alt={peer?.username} className="audio-avatar-img" />
                  </div>
                  <h3>{peer?.username}</h3>
                  <div className="audio-wave-animation">
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                    <span className="wave-bar" />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '10px' }}>
                    {isVideo ? 'Remote camera paused or disabled' : 'Voice call in progress'}
                  </p>
                </div>
              )}

              {/* Picture-in-picture local preview */}
              {isVideo && (
                <div className="pip-local-container">
                  {!isVideoOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="pip-local-video"
                    />
                  ) : (
                    <div className="pip-cam-off-placeholder">
                      <VideoOff size={18} color="var(--text-muted)" />
                      <span>Camera Off</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Floating Controls Bar */}
        <div className="call-control-bar">
          <button
            type="button"
            className={`call-ctrl-btn ${isMuted ? 'active-mute' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            <span className="ctrl-label">{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          {isVideo && (
            <button
              type="button"
              className={`call-ctrl-btn ${isVideoOff ? 'active-mute' : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              <span className="ctrl-label">{isVideoOff ? 'Cam Off' : 'Camera'}</span>
            </button>
          )}

          <button
            type="button"
            className={`call-ctrl-btn ${showStatsModal ? 'active-diag' : ''}`}
            onClick={() => setShowStatsModal(!showStatsModal)}
            title="Toggle Quality Diagnostics"
          >
            <Activity size={20} />
            <span className="ctrl-label">Quality</span>
          </button>

          <button
            type="button"
            className="call-ctrl-btn end-call-btn"
            onClick={() => {
              if (callState === 'OUTGOING_RINGING') {
                cancelOutgoingCall();
              } else {
                endCall('Call ended by user');
              }
            }}
            title="End Call"
          >
            <PhoneOff size={22} />
            <span className="ctrl-label">End</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
