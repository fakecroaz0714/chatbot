# 🌙 HalalChat — Real-Time Event-Driven Messenger

A modern, production-grade, event-driven real-time chat and calling application built with **React**, **Capacitor (Android)**, **Node.js / Express**, **Socket.IO**, **WebRTC**, **PostgreSQL (Prisma)**, **Redis**, and **AWS S3**.

---

## 1. Architecture Overview

```text
                    HALALCHAT APPLICATION
                 (Web Browser & Android App)
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
            REST          WebSocket          S3
              │               │               │
              ▼               ▼               ▼
         History/API     Live events        Files
              │          & WebRTC Calls       │
              └───────────────┬───────────────┘
                              ▼
                         PostgreSQL
                              +
                            Redis
```

- **REST API**: Persistent history retrieval, cursor pagination, authentication, user search.
- **WebSocket (Socket.IO)**: Low-latency live events (instant messaging, presence, debounced typing indicators, delivery and read receipts, WebRTC call signaling).
- **PostgreSQL (Prisma)**: Source of truth for users, conversations, memberships, and message records.
- **Redis**: Multi-device online presence tracking, connection state, and horizontal Socket.IO pub/sub scaling (with automatic in-memory fallback for local zero-config development).
- **AWS S3**: Secure direct-to-bucket file uploads via presigned URLs (with local disk fallback for dev).
- **Capacitor Android**: Native Android WebView container enabling cross-platform mobile app distribution with full WebRTC audio/video call support.

---

## 2. Project Structure

```text
chatbot/
│
├── client/                     # React + Vite + Capacitor frontend
│   ├── android/                # Native Android Studio project (Capacitor)
│   │   └── app/
│   │       ├── src/main/AndroidManifest.xml
│   │       └── src/main/res/   # HalalChat adaptive launcher icons & branding
│   ├── public/
│   │   ├── halalchat-logo.svg
│   │   └── halalchat-app-icon.svg
│   ├── src/
│   │   ├── components/         # Chat, Message, Sidebar, CallDialog, Presence
│   │   ├── pages/              # Login, Register, Chat
│   │   ├── services/           # api, socket, webrtc
│   │   └── utils/              # config.js (cross-platform API/Socket resolution)
│   ├── capacitor.config.json   # Capacitor configuration (App ID: com.halalchat.app)
│   └── vite.config.js
│
├── server/                     # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── controllers/        # auth, user, conversation, message, file
│   │   ├── routes/             # authRoutes, userRoutes, conversationRoutes, fileRoutes
│   │   ├── socket/             # socketServer, callHandler, messageHandler, presenceHandler
│   │   └── utils/              # cors.js (configured for web & Capacitor Android origins)
│   └── prisma/
│
├── apk/                        # Generated Android APK artifacts
│   ├── HalalChat-debug.apk
│   └── HalalChat-release-unsigned.apk
│
├── scripts/
│   ├── build-android.sh        # Automated Android build script (debug/release)
│   └── sign-release-apk.sh     # Production release APK signing script
│
├── docker-compose.yml          # PostgreSQL, Redis, Server, and Client production stack
├── .env.example                # Environment variables template
└── README.md
```

---

## 3. Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- Java JDK 21 (for Android builds)
- Android SDK (for Android builds)

### Local Development (Zero-Dependency Mode)
The application is preconfigured with zero-friction fallbacks:
- SQLite for instant database setup without needing a local PostgreSQL server.
- In-memory presence and pub/sub when local Redis is not running.
- Local uploads endpoint when AWS credentials are not configured.

1. **Install dependencies**:
   ```bash
   # In client
   cd client && npm install

   # In server
   cd ../server && npm install
   ```

2. **Generate DB Client & Push Schema**:
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   ```

3. **Start Server**:
   ```bash
   cd server
   npm run dev
   # Runs on http://localhost:5001
   ```

4. **Start Client**:
   ```bash
   cd client
   npm run dev
   # Runs on http://localhost:5173
   ```

---

## 4. Android Application Packaging

HalalChat includes first-class Android support powered by Capacitor:
- **Application ID**: `com.halalchat.app`
- **Application Label**: `HalalChat`
- **Permissions**: Camera (`android.permission.CAMERA`), Audio/Microphone (`android.permission.RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`), Internet, Network State.

### Cross-Platform API & WebSocket Endpoint Resolution
Inside the native Android WebView (`http://localhost` / `capacitor://localhost`), relative API paths do not automatically point to the backend. HalalChat resolves backend endpoints dynamically:
1. **Build Time**: Set `VITE_API_URL` during client build:
   ```bash
   VITE_API_URL="https://your-api.example.com" npm --prefix client run build
   ```
2. **Android Emulator Default**: If `VITE_API_URL` is omitted, native Android defaults to `http://10.0.2.2:5001`.
3. **Runtime Override**: The server URL can be customized at runtime without rebuilding:
   ```javascript
   localStorage.setItem('halalchat_server_url', 'https://your-api.example.com');
   ```

### Building the Android APK

1. **Build Debug APK**:
   ```bash
   # Using the build script:
   ./scripts/build-android.sh debug

   # Or using npm:
   npm run android:build
   ```
   **Output**: `apk/HalalChat-debug.apk` (and `client/android/app/build/outputs/apk/debug/app-debug.apk`).
   *This APK is signed with the standard Android debug keystore and is immediately shareable and installable on test devices/emulators.*

2. **Build Unsigned Release APK**:
   ```bash
   ./scripts/build-android.sh release

   # Or using npm:
   npm run android:release
   ```
   **Output**: `apk/HalalChat-release-unsigned.apk` (and `client/android/app/build/outputs/apk/release/app-release-unsigned.apk`).
   *This APK is an unsigned release build optimized for production distribution.*

### Signing the Release APK

To produce a signed release APK for Google Play or enterprise distribution:

1. **Generate a keystore** (if you don't already have one):
   ```bash
   keytool -genkey -v -keystore halalchat-release.keystore -alias halalchat -keyalg RSA -keysize 2048 -validity 10000
   ```
   > ⚠️ **Important**: Never commit `.keystore` or `.jks` files or signing passwords to Git!

2. **Sign the APK**:
   ```bash
   ./scripts/sign-release-apk.sh halalchat-release.keystore halalchat apk/HalalChat-release.apk
   ```
   The verified, signed release APK will be generated at `apk/HalalChat-release.apk`.

---

## 5. Testing Real-Time Messaging & Calling

1. Open `http://localhost:5173` in two separate browser windows (or browser + Android device).
2. Register two accounts (e.g. `user1` and `user2`) or sign in.
3. Start a conversation and test:
   - **Live Messaging**: Instant text delivery with delivery (`✓`) and read (`✓✓`) receipts.
   - **Typing Indicators**: Real-time typing indicators with debounce.
   - **Presence**: Real-time online/offline status badge.
   - **Voice & Video Calling**: Click the phone or video camera icon to initiate a 1-on-1 WebRTC call with camera toggle, mic mute/unmute, and hang-up controls.

---

## 6. Socket.IO Event Contract

| Event | Direction | Payload | Description |
|---|---|---|---|
| `user:online` | Server → Client | `{ userId, username, timestamp }` | Broadcasted when a user connects |
| `user:offline` | Server → Client | `{ userId, username, timestamp }` | Broadcasted when user has 0 active sockets |
| `presence:get` | Client → Server | `(callback) => { onlineUsers }` | Fetches active online user IDs |
| `message:send` | Client → Server | `{ conversationId, content, messageType, fileUrl, ... }` | Sends message (DB saved first) |
| `message:new` | Server → Client | `Message` | Broadcasted to room `conversation:${id}` |
| `message:read` | Client → Server | `{ messageId, conversationId }` | Marks message as read in DB |
| `message:read:update` | Server → Client | `{ messageId, conversationId, userId, readAt }` | Broadcasts read receipt |
| `typing:start` | Client → Server | `{ conversationId }` | Triggers "User is typing..." |
| `typing:stop` | Client → Server | `{ conversationId }` | Clears typing indicator |
| `call:initiate` | Client → Server | `{ targetUserId, conversationId, type }` | Initiates WebRTC voice/video call session |
| `call:ringing` | Server → Caller | `{ callId, targetUserId, type, targetUser }` | Confirms recipient device is ringing |
| `call:incoming` | Server → Callee | `{ callId, type, conversationId, caller }` | Delivers incoming call dialog to recipient |
| `call:accept` | Callee → Server | `{ callId }` | Accepts call and transitions session to connected |
| `call:accepted` | Server → Caller | `{ callId, type, callee }` | Signals caller to create and emit WebRTC offer |
| `call:offer` | Peer ↔ Server | `{ callId, sdp }` | Authenticated exchange of WebRTC SDP offer |
| `call:answer` | Peer ↔ Server | `{ callId, sdp }` | Authenticated exchange of WebRTC SDP answer |
| `call:ice-candidate` | Peer ↔ Server | `{ callId, candidate }` | Authenticated exchange of ICE candidate |
| `call:reject` | Peer → Server | `{ callId, reason }` | Callee declines or caller cancels call |
| `call:busy` | Server → Caller | `{ targetUserId, reason }` | Emitted when target is already engaged in a call |
| `call:unavailable` | Server → Caller | `{ targetUserId, reason }` | Emitted when target is currently offline |
| `call:ended` | Server → Peers | `{ callId, reason, endedBy }` | Terminates call and triggers media track cleanup |

---

## 7. Security Highlights

- **JWT Session Verification**: Checked on all REST requests and Socket handshake.
- **Conversation Authorization**: Every message send or read operation validates `ConversationMember` relations in PostgreSQL before proceeding.
- **CORS Protection**: Whitelisted for production domain, local dev, and Android Capacitor origins (`capacitor://localhost`, `http://localhost`, `https://localhost`).
- **Client Bundle Isolation**: No server secrets, database credentials, or JWT signing secrets are exposed to the client or Android bundle.
- **Rate Limiting**: `express-rate-limit` prevents brute-force authentication and spam.
- **Security Headers**: `helmet` configured with cross-origin policies.

