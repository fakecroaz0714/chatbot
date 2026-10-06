import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import fileRoutes from './routes/fileRoutes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { initSocketServer } from './socket/socketServer.js';
import { corsOrigin } from './utils/cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Security Headers (Section 19: Security layer)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Vercel function filesystems are read-only outside /tmp and do not persist
// between invocations. Keep the disk-backed upload fallback for local runs only.
if (!process.env.VERCEL) {
  const uploadsDir = path.resolve('uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'realtime-chat-server',
  });
});

// REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/files', fileRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized error handler
app.use(errorHandler);

// Initialize Socket.IO Server
const io = initSocketServer(httpServer);

// Vercel serves the exported HTTP server as a function. Local and Docker runs
// still own their listener and use the configured port.
if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Real-Time Chat Server running on port ${PORT}`);
    console.log(`📡 WebSocket ready on port ${PORT}`);
    console.log(`🔒 Security layer active (Helmet + RateLimiter + JWT)`);
    console.log(`💻 Client URL allowed: ${CLIENT_URL}`);
    console.log(`=========================================`);
  });
}

export { app, httpServer, io };
export default httpServer;
