import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('Set JWT_SECRET in server/.env before running the socket test.');

const alexToken = jwt.sign({ userId: 'a24b82ac-410f-4b49-962c-c08dc6bec426' }, jwtSecret, { expiresIn: '5m' });
const rahulToken = jwt.sign({ userId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5' }, jwtSecret, { expiresIn: '5m' });
const conversationId = '7abcc787-1989-46c4-8539-6c7bb7dc82fc';

console.log('--- Connecting Alex and Rahul to Socket.IO server ---');

const alexSocket = io('http://localhost:5001', {
  auth: { token: alexToken },
});

const rahulSocket = io('http://localhost:5001', {
  auth: { token: rahulToken },
});

let testsPassed = 0;

alexSocket.on('connect', () => {
  console.log('✅ Alex connected successfully! Socket ID:', alexSocket.id);
  alexSocket.emit('conversation:join', conversationId);
});

rahulSocket.on('connect', () => {
  console.log('✅ Rahul connected successfully! Socket ID:', rahulSocket.id);
  rahulSocket.emit('conversation:join', conversationId);

  // Once both are connected, Rahul listens for message
  rahulSocket.on('message:new', (msg) => {
    console.log(`✅ Real-time message received by Rahul: "${msg.content}" from ${msg.sender?.username}`);
    testsPassed++;

    // Rahul marks message as read
    console.log('--- Rahul emitting message:read ---');
    rahulSocket.emit('message:read', { messageId: msg.id, conversationId });
  });

  // Rahul listens for typing
  rahulSocket.on('typing:start', (data) => {
    console.log(`✅ Typing indicator received by Rahul: "${data.username} is typing..."`);
    testsPassed++;
  });
});

alexSocket.on('message:read:update', (data) => {
  console.log('✅ Read receipt received by Alex! Message marked read at:', data.readAt);
  testsPassed++;

  console.log(`\n🎉 ALL REAL-TIME SOCKET TESTS PASSED (${testsPassed} events verified)!\n`);
  alexSocket.disconnect();
  rahulSocket.disconnect();
  process.exit(0);
});

// Trigger events after 1 second
setTimeout(() => {
  console.log('--- Alex starts typing ---');
  alexSocket.emit('typing:start', { conversationId });

  setTimeout(() => {
    console.log('--- Alex sending message: "Hello Rahul! This is an event-driven system." ---');
    alexSocket.emit('message:send', {
      conversationId,
      content: 'Hello Rahul! This is an event-driven system.',
      messageType: 'TEXT',
    });
  }, 500);
}, 1000);

setTimeout(() => {
  console.error('❌ Test timed out!');
  process.exit(1);
}, 8000);
