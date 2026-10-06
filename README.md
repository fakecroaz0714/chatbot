# ⚡ PulseChat — Real-Time Event-Driven Messenger

A production-grade, event-driven real-time chat application built with **React**, **Node.js / Express**, **Socket.IO**, **PostgreSQL (Prisma)**, **Redis**, and **AWS S3**.

---

## 1. Architecture Overview

```text
                    CHAT APPLICATION
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
           REST       WebSocket       S3
             │            │            │
             ▼            ▼            ▼
        History/API    Live events    Files
             │            │
             └──────┬─────┘
                    ▼
               PostgreSQL
                    +
                  Redis
```

- **REST API**: Persistent history retrieval, cursor pagination, authentication, user search.
- **WebSocket (Socket.IO)**: Low-latency live events (instant messaging, presence, debounced typing indicators, delivery and read receipts).
- **PostgreSQL (Prisma)**: Source of truth for users, conversations, memberships, and message records.
- **Redis**: Multi-device online presence tracking, connection state, and horizontal Socket.IO pub/sub scaling (with automatic in-memory fallback for local zero-config development).
- **AWS S3**: Secure direct-to-bucket file uploads via presigned URLs (with local disk fallback for dev).

---

## 2. Project Structure

```text
chatbot/
│
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/           # ChatHeader, ChatWindow, MessageInput, TypingIndicator
│   │   │   ├── Message/        # MessageBubble, MessageList (cursor pagination)
│   │   │   ├── Sidebar/        # Sidebar, ConversationList, UserSearchModal, UserProfileBar
│   │   │   ├── Presence/       # StatusBadge (online/offline indicator)
│   │   │   └── FileUpload/     # FilePreview
│   │   ├── pages/              # Login, Register, Chat
│   │   ├── hooks/              # useSocket, useChat, usePresence
│   │   ├── services/           # api (axios), socket (socket.io client)
│   │   ├── store/              # Zustand stores (auth, conversation, message, presence, socket)
│   │   └── styles/             # Modern CSS tokens, dark theme, micro-animations
│   ├── Dockerfile
│   └── nginx.conf
│
├── server/                     # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── controllers/        # auth, user, conversation, message, file
│   │   ├── routes/             # authRoutes, userRoutes, conversationRoutes, fileRoutes
│   │   ├── services/           # redisService (multi-device presence), s3Service (presigned URLs)
│   │   ├── socket/             # socketServer, socketAuth, messageHandler, presenceHandler, typingHandler
│   │   ├── middleware/         # authMiddleware, rateLimiter, errorHandler
│   │   ├── db/                 # prisma client
│   │   └── server.js           # Server entrypoint with Helmet, CORS, and Socket.IO
│   ├── prisma/
│   │   ├── schema.prisma       # Active schema (SQLite zero-dependency local / PostgreSQL ready)
│   │   └── schema.postgres.prisma # Production PostgreSQL schema
│   └── Dockerfile
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

## 4. Multi-User Real-Time Testing

Open **two separate browser windows** (or one normal and one incognito window):
1. **Window A**: Open `http://localhost:5173` and click **👤 Alex** (Instant 1-click test account).
2. **Window B**: Open `http://localhost:5173` and click **👤 Rahul** (Instant 1-click test account).
3. In Window A, click the `+` button in the sidebar, search for `Rahul`, and click the chat icon.
4. **Test Real-Time Features**:
   - **Live Messaging**: Type a message in Window A — Window B receives it instantly.
   - **Typing Indicator**: Start typing in Window B — Window A displays *"Rahul is typing..."* with animated bouncing dots.
   - **Read Receipts**: When Window B views the message, Window A's checkmarks change from single ✓ to double blue ✓✓.
   - **Online Presence**: Close Window B or disconnect — Window A displays Rahul's status transition from green (Online) to grey (Offline).
   - **File Sharing**: Click the paperclip icon in Window A and send an image or document.

---

## 5. Production Deployment with Docker

To deploy the entire production stack (PostgreSQL, Redis, Node.js API, and Nginx-backed React Client):

```bash
# 1. Configure environment variables, then replace POSTGRES_PASSWORD and JWT_SECRET
cp .env.example .env

# 2. Start all services
docker-compose up --build -d
```

Services started:
- `client`: `http://localhost:5173`
- `server`: `http://localhost:5001`
- `postgres`: `localhost:5432`
- `redis`: `localhost:6379`

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
- **Rate Limiting**: `express-rate-limit` prevents brute-force authentication and spam.
- **Security Headers**: `helmet` configured with cross-origin policies.
- **S3 Upload Safety**: Random UUID-based object keys (`uploads/YYYY/MM/<uuid>.<ext>`) prevent directory traversal and filename collisions.
