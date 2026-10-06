import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('Set JWT_SECRET in server/.env before running test.');

const alexToken = jwt.sign({ userId: 'a24b82ac-410f-4b49-962c-c08dc6bec426' }, jwtSecret, { expiresIn: '5m' });
const rahulToken = jwt.sign({ userId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5' }, jwtSecret, { expiresIn: '5m' });

console.log('--- Testing WebRTC Call Edge Cases & Errors ---');

const alexSocket = io('http://localhost:5001', {
  auth: { token: alexToken },
});

let rahulSocket = null;
let testsPassed = 0;

alexSocket.on('connect', () => {
  console.log('✅ Alex connected. Step 1: Testing call to offline user...');
  alexSocket.emit('call:initiate', {
    targetUserId: 'c898fbaf-3d67-44ff-8551-458db574501f', // Chandru (offline)
    type: 'voice',
  });
});

alexSocket.once('call:unavailable', (data) => {
  console.log('✅ Received call:unavailable for offline user as expected:', data.reason);
  testsPassed++;

  console.log('--- Step 2: Testing self-call rejection ---');
  alexSocket.emit('call:initiate', {
    targetUserId: 'a24b82ac-410f-4b49-962c-c08dc6bec426', // Alex calling Alex
    type: 'video',
  });
});

alexSocket.once('call:error', (data) => {
  if (data.error === 'You cannot call yourself') {
    console.log('✅ Received self-call rejection as expected:', data.error);
    testsPassed++;
    testDeclineFlow();
  }
});

const testDeclineFlow = () => {
  console.log('--- Step 3: Testing call decline (callee rejects) ---');
  rahulSocket = io('http://localhost:5001', {
    auth: { token: rahulToken },
  });

  rahulSocket.once('connect', () => {
    alexSocket.emit('call:initiate', {
      targetUserId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5',
      type: 'voice',
    });
  });

  rahulSocket.once('call:incoming', (data) => {
    console.log('✅ Rahul got incoming call, declining with reason...');
    rahulSocket.emit('call:reject', {
      callId: data.callId,
      reason: 'In a meeting right now',
    });
  });

  alexSocket.once('call:rejected', (data) => {
    console.log('✅ Alex received call:rejected with reason:', data.reason);
    testsPassed++;

    testCancellationFlow();
  });
};

const testCancellationFlow = () => {
  console.log('--- Step 4: Testing caller cancellation before answer ---');
  alexSocket.emit('call:initiate', {
    targetUserId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5',
    type: 'video',
  });

  alexSocket.once('call:ringing', (data) => {
    console.log('✅ Alex ringing, cancelling outgoing call before Rahul answers...');
    alexSocket.emit('call:reject', {
      callId: data.callId,
      reason: 'Caller cancelled',
    });
  });

  rahulSocket.once('call:cancelled', () => {
    console.log('✅ Rahul received call:cancelled successfully!');
    testsPassed++;

    console.log(`\n🎉 ALL CALL EDGE CASES & ERROR HANDLING TESTS PASSED (${testsPassed} cases verified)!\n`);
    alexSocket.disconnect();
    rahulSocket.disconnect();
    process.exit(0);
  });
};

setTimeout(() => {
  console.error(`❌ Edge cases test timed out! Tests passed: ${testsPassed}`);
  process.exit(1);
}, 8000);
