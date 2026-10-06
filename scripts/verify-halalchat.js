const axios = require('../client/node_modules/axios');
const { io } = require('../client/node_modules/socket.io-client');

const API_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

async function runSmokeTest() {
  console.log('====================================================');
  console.log('🌙 HALALCHAT END-TO-END SMOKE TEST & VERIFICATION');
  console.log('====================================================\n');

  // Test 1: CORS validation for Android native Capacitor origins
  console.log('1. Testing CORS headers with Android Capacitor origin (capacitor://localhost)...');
  const corsResponse = await axios.options(`${API_URL}/auth/login`, {
    headers: {
      Origin: 'capacitor://localhost',
      'Access-Control-Request-Method': 'POST',
    },
  });
  const allowOrigin = corsResponse.headers['access-control-allow-origin'];
  console.log(`   CORS Access-Control-Allow-Origin: "${allowOrigin}"`);
  if (allowOrigin !== 'capacitor://localhost') {
    throw new Error(`CORS validation failed for capacitor://localhost! Got: ${allowOrigin}`);
  }
  console.log('   ✅ CORS allows Android Capacitor origin successfully.\n');

  // Test 2: User Registration & Login
  const uniqueId = Date.now();
  const testUsername = `user_${uniqueId}`;
  const testEmail = `user_${uniqueId}@halalchat.test`;
  const testPassword = 'Password123!';

  console.log(`2. Registering fresh user: ${testUsername} (${testEmail})...`);
  const registerRes = await axios.post(`${API_URL}/auth/register`, {
    username: testUsername,
    email: testEmail,
    password: testPassword,
  });
  console.log(`   Registered successfully! ID: ${registerRes.data.user.id}`);

  console.log(`   Logging in as ${testUsername}...`);
  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    loginId: testUsername,
    password: testPassword,
  });
  const { user, token } = loginRes.data;
  console.log(`   Logged in successfully as: ${user.username} (${user.id})`);
  console.log('   ✅ JWT received successfully.\n');

  // Test 3: Create Conversations with Alex and Rahul
  console.log('3. Creating 2 conversations (with Alex and Rahul)...');
  const alexRes = await axios.post(
    `${API_URL}/conversations`,
    { recipientId: 'a24b82ac-410f-4b49-962c-c08dc6bec426' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const conv1 = alexRes.data.conversation;
  console.log(`   Conversation 1 created with Alex: ID ${conv1.id}`);

  const rahulRes = await axios.post(
    `${API_URL}/conversations`,
    { recipientId: 'c16b7d1d-6084-40a0-a499-0ea82d1d87f5' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const conv2 = rahulRes.data.conversation;
  console.log(`   Conversation 2 created with Rahul: ID ${conv2.id}`);

  // Test 4: List conversations
  console.log('4. Listing user conversations from API...');
  const convsRes = await axios.get(`${API_URL}/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const conversations = convsRes.data.conversations;
  console.log(`   Found ${conversations.length} active conversations for user.`);
  console.log('   ✅ Conversations list retrieved successfully.\n');

  // Test 5: Load messages for conversation 1
  console.log(`5. Loading messages for Conversation 1 (${conv1.id})...`);
  const msgRes1 = await axios.get(`${API_URL}/conversations/${conv1.id}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   Loaded ${msgRes1.data.messages.length} messages.`);
  console.log('   ✅ Messages loaded successfully.\n');

  // Test 6: Switch between chats -> Conversation 2
  console.log(`6. Switching between chats -> Conversation 2 (${conv2.id})...`);
  const msgRes2 = await axios.get(`${API_URL}/conversations/${conv2.id}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   Loaded ${msgRes2.data.messages.length} messages for Conversation 2.`);
  console.log('   ✅ Smooth switching between chats verified.\n');

  // Test 7: Socket.IO Connection & Live Messaging
  console.log('7. Connecting to Socket.IO with JWT...');
  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`   Connected to Socket.IO! ID: ${socket.id}`);
      resolve();
    });
    socket.on('connect_error', reject);
  });

  console.log(`   Joining conversation room ${conv1.id}...`);
  socket.emit('conversation:join', conv1.id);

  console.log('   Sending test live message via Socket.IO...');
  const testContent = `HalalChat verification message at ${new Date().toISOString()}`;
  const sendPromise = new Promise((resolve, reject) => {
    socket.emit(
      'message:send',
      {
        conversationId: conv1.id,
        content: testContent,
        messageType: 'TEXT',
        clientTempId: `temp-${Date.now()}`,
      },
      (ack) => {
        if (ack?.status === 'error') {
          reject(new Error(ack.error));
        } else {
          console.log(`   Message saved and broadcast with ID: ${ack?.data?.id || 'acknowledged'}`);
          resolve(ack);
        }
      }
    );
  });

  await sendPromise;
  console.log('   ✅ Socket.IO real-time message sent and acknowledged successfully.\n');

  socket.disconnect();

  console.log('====================================================');
  console.log('🎉 ALL SMOKE TESTS AND VERIFICATIONS PASSED 100%!');
  console.log('====================================================');
}

runSmokeTest().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
