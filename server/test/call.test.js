import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('Set JWT_SECRET in server/.env before running the call test.');

const alexToken = jwt.sign({ userId: 'a24b82ac-410f-4b49-962c-c08dc6bec426' }, jwtSecret, { expiresIn: '5m' });
const rahulToken = jwt.sign({ userId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5' }, jwtSecret, { expiresIn: '5m' });

console.log('--- Connecting Alex and Rahul for Call Signaling Test ---');

const alexSocket = io('http://localhost:5001', {
  auth: { token: alexToken },
});

const rahulSocket = io('http://localhost:5001', {
  auth: { token: rahulToken },
});

let alexConnected = false;
let rahulConnected = false;
let activeCallId = null;
let testsPassed = 0;

const runTests = () => {
  if (!alexConnected || !rahulConnected) return;

  console.log('--- Step 1: Alex calls Rahul ---');
  alexSocket.emit('call:initiate', {
    targetUserId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5',
    type: 'video',
  });
};

alexSocket.on('connect', () => {
  console.log('✅ Alex connected for call test');
  alexConnected = true;
  runTests();
});

rahulSocket.on('connect', () => {
  console.log('✅ Rahul connected for call test');
  rahulConnected = true;
  runTests();
});

// Alex receives ringing
alexSocket.on('call:ringing', (data) => {
  console.log('✅ Alex received call:ringing with callId:', data.callId);
  testsPassed++;
  activeCallId = data.callId;
});

// Rahul receives incoming call
rahulSocket.on('call:incoming', (data) => {
  console.log(`✅ Rahul received call:incoming from ${data.caller.username} (type: ${data.type})`);
  testsPassed++;
  activeCallId = data.callId;

  // Rahul accepts after 200ms
  setTimeout(() => {
    console.log('--- Step 2: Rahul accepts call ---');
    rahulSocket.emit('call:accept', { callId: data.callId });
  }, 200);
});

// Alex receives call:accepted
alexSocket.on('call:accepted', (data) => {
  console.log('✅ Alex received call:accepted from:', data.callee.username);
  testsPassed++;

  // Step 3: Alex sends SDP offer
  console.log('--- Step 3: Alex sends WebRTC SDP offer ---');
  alexSocket.emit('call:offer', {
    callId: data.callId,
    sdp: { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' },
  });
});

// Rahul receives offer and answers
rahulSocket.on('call:offer', (data) => {
  console.log('✅ Rahul received call:offer with SDP');
  testsPassed++;

  console.log('--- Step 4: Rahul sends WebRTC SDP answer ---');
  rahulSocket.emit('call:answer', {
    callId: data.callId,
    sdp: { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' },
  });
});

// Alex receives answer
alexSocket.on('call:answer', (data) => {
  console.log('✅ Alex received call:answer with SDP');
  testsPassed++;

  console.log('--- Step 5: Alex sends ICE candidate ---');
  alexSocket.emit('call:ice-candidate', {
    callId: data.callId,
    candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  });
});

// Rahul receives candidate
rahulSocket.on('call:ice-candidate', (data) => {
  console.log('✅ Rahul received ICE candidate');
  testsPassed++;

  console.log('--- Step 6: Alex hangs up call ---');
  alexSocket.emit('call:end', { callId: data.callId, reason: 'Completed test' });
});

// Rahul receives call:ended
rahulSocket.on('call:ended', (data) => {
  console.log('✅ Rahul received call:ended. Reason:', data.reason);
  testsPassed++;

  console.log(`\n🎉 ALL WEBRTC CALL SIGNALING TESTS PASSED (${testsPassed} steps verified)!\n`);
  alexSocket.disconnect();
  rahulSocket.disconnect();
  process.exit(0);
});

alexSocket.on('call:error', (err) => {
  console.error('❌ Alex call error:', err);
  process.exit(1);
});

rahulSocket.on('call:error', (err) => {
  console.error('❌ Rahul call error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error(`❌ Call test timed out after 8s! Passed steps: ${testsPassed}`);
  process.exit(1);
}, 8000);
