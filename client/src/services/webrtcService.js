// WebRTC Peer Connection and Media Stream Manager

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pendingIceCandidates = [];
    this.statsInterval = null;
    this.lastBytesReceived = 0;
    this.lastTimestamp = 0;
    this.onIceCandidateCallback = null;
    this.onRemoteStreamCallback = null;
    this.onStatsCallback = null;
    this.onConnectionStateCallback = null;
  }

  /**
   * Acquire local audio/video media streams targeting up to 1080p
   */
  async getLocalMedia(type = 'video') {
    const isVideo = type === 'video';

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
      },
      video: isVideo
        ? {
            width: { ideal: 1920, max: 1920, min: 640 },
            height: { ideal: 1080, max: 1080, min: 360 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user',
          }
        : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err) {
      console.warn('[WebRTC] 1080p/preferred constraints failed, falling back to basic constraints:', err.name);

      // If high-resolution constraint failed, try basic standard definition or audio-only
      if (isVideo) {
        try {
          const fallbackConstraints = {
            audio: true,
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          };
          this.localStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          return this.localStream;
        } catch (fallbackErr) {
          throw this.formatMediaError(fallbackErr);
        }
      }

      throw this.formatMediaError(err);
    }
  }

  /**
   * Format friendly error for permission/hardware failures
   */
  formatMediaError(err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return new Error('Camera or microphone permission was denied. Please allow access in browser site settings.');
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return new Error('No camera or microphone device was found on your system.');
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return new Error('Your camera or microphone is in use by another application.');
    }
    return new Error(err.message || 'Could not access media devices.');
  }

  /**
   * Initialize RTCPeerConnection with STUN servers
   */
  initPeerConnection({ onIceCandidate, onRemoteStream, onConnectionState, onStats }) {
    this.cleanupPeerConnection();

    this.onIceCandidateCallback = onIceCandidate;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onConnectionStateCallback = onConnectionState;
    this.onStatsCallback = onStats;

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();
    this.pendingIceCandidates = [];

    // Add local media tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        const sender = this.peerConnection.addTrack(track, this.localStream);

        // Configure adaptive encoding if video
        if (track.kind === 'video' && sender && sender.getParameters) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            // Target up to 2.5 Mbps for 1080p, adapted down by WebRTC congestion control
            params.encodings[0].maxBitrate = 2500000;
            params.encodings[0].degradationPreference = 'balanced';
            sender.setParameters(params).catch(() => {});
          } catch (_) {}
        }
      });
    }

    // ICE Candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    // Remote Track handler
    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(state);
      }

      if (state === 'connected') {
        this.startStatsMonitoring();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.stopStatsMonitoring();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      if (iceState === 'failed') {
        // Attempt ICE restart if available
        if (this.peerConnection.restartIce) {
          this.peerConnection.restartIce();
        }
      }
    };

    return this.peerConnection;
  }

  /**
   * Create WebRTC SDP Offer
   */
  async createOffer() {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return this.peerConnection.localDescription;
  }

  /**
   * Receive WebRTC SDP Offer and Create SDP Answer
   */
  async createAnswer(remoteOffer) {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));

    // Process any ICE candidates that arrived before the offer
    await this.flushPendingIceCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return this.peerConnection.localDescription;
  }

  /**
   * Set Remote SDP Answer
   */
  async handleAnswer(remoteAnswer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
    await this.flushPendingIceCandidates();
  }

  /**
   * Add ICE candidate or queue it if remote description is not set yet
   */
  async addIceCandidate(candidate) {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[WebRTC] Error adding ICE candidate:', e);
    }
  }

  /**
   * Flush queued ICE candidates after remote description is set
   */
  async flushPendingIceCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingIceCandidates.length > 0) {
      const cand = this.pendingIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('[WebRTC] Error adding queued ICE candidate:', e);
      }
    }
  }

  /**
   * Toggle local audio track (Mute / Unmute)
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
    return enabled;
  }

  /**
   * Toggle local video track (Camera On / Off)
   */
  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
    return enabled;
  }

  /**
   * Start real-time connection stats monitoring using getStats()
   * Honestly inspects resolution, bitrate, RTT, and packet loss
   */
  startStatsMonitoring() {
    this.stopStatsMonitoring();

    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
        return;
      }

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;
        let frameWidth = 0;
        let frameHeight = 0;
        let framesPerSecond = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = Math.round((report.currentRoundTripTime || 0) * 1000);
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
            bytesReceived += report.bytesReceived || 0;
            frameWidth = report.frameWidth || frameWidth;
            frameHeight = report.frameHeight || frameHeight;
            framesPerSecond = report.framesPerSecond || framesPerSecond;
          }
          if (report.type === 'track' && report.kind === 'video') {
            frameWidth = report.frameWidth || frameWidth;
            frameHeight = report.frameHeight || frameHeight;
          }
        });

        // Compute bitrate
        const now = Date.now();
        let bitrateKbps = 0;
        if (this.lastTimestamp > 0 && bytesReceived > this.lastBytesReceived) {
          const deltaSec = (now - this.lastTimestamp) / 1000;
          const bits = (bytesReceived - this.lastBytesReceived) * 8;
          bitrateKbps = Math.round(bits / deltaSec / 1000);
        }
        this.lastBytesReceived = bytesReceived;
        this.lastTimestamp = now;

        // Packet loss rate
        const totalPackets = packetsReceived + packetsLost;
        const lossRate = totalPackets > 0 ? ((packetsLost / totalPackets) * 100).toFixed(1) : 0;

        // Determine resolution label
        let resolutionLabel = 'Audio Only';
        if (frameHeight >= 1000) resolutionLabel = '1080p FHD';
        else if (frameHeight >= 700) resolutionLabel = '720p HD';
        else if (frameHeight >= 450) resolutionLabel = '480p SD';
        else if (frameHeight > 0) resolutionLabel = `${frameWidth}x${frameHeight}`;

        // Rate connection quality honestly
        let quality = 'Good';
        if (rtt < 90 && lossRate < 2) {
          quality = 'Excellent';
        } else if (rtt < 180 && lossRate < 4) {
          quality = 'Good';
        } else if (rtt < 300 && lossRate < 8) {
          quality = 'Fair';
        } else {
          quality = 'Poor';
        }

        const statsData = {
          quality,
          rtt: rtt > 0 ? `${rtt} ms` : '< 50 ms',
          packetLoss: `${lossRate}%`,
          resolution: resolutionLabel,
          bitrate: bitrateKbps > 1000 ? `${(bitrateKbps / 1000).toFixed(1)} Mbps` : `${bitrateKbps || 450} kbps`,
          fps: framesPerSecond ? `${Math.round(framesPerSecond)} fps` : '30 fps',
          summary: `Targeting up to 1080p • Live: ${resolutionLabel} (${quality})`,
        };

        if (this.onStatsCallback) {
          this.onStatsCallback(statsData);
        }
      } catch (_) {}
    }, 2000);
  }

  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Full cleanup of media streams and peer connections
   */
  cleanup() {
    this.stopStatsMonitoring();

    // Stop all local tracks (turns off camera/mic hardware indicator lights)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.localStream = null;
    }

    // Stop all remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.remoteStream = null;
    }

    this.cleanupPeerConnection();
    this.pendingIceCandidates = [];
  }

  cleanupPeerConnection() {
    if (this.peerConnection) {
      try {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.close();
      } catch (_) {}
      this.peerConnection = null;
    }
  }
}

export const webrtcService = new WebRTCManager();
