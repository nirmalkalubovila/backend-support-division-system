/**
 * socket.js
 * Initialises Socket.IO and wires JWT auth to every connection.
 * Rooms: project:<projectId>  — all users viewing the same project board join this room.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const logger = require('./logger');
const { User } = require('../models');

let io;

const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ──────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(payload.sub).select('name role isActive deletedAt');
      if (!user || !user.isActive || user.deletedAt) return next(new Error('User not found or inactive'));
      socket.userId = String(user._id);
      socket.userRole = user.role;
      socket.userName = user.name;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info(`WS connected: ${socket.id} (user=${socket.userId})`);

    // Join a private room specific to this user to receive direct notifications
    socket.join(`user:${socket.userId}`);
    logger.info(`Socket ${socket.id} joined user:${socket.userId}`);

    // Client joins a project room to receive board updates
    socket.on('join:project', (projectId) => {
      socket.join(`project:${projectId}`);
      logger.info(`Socket ${socket.id} joined project:${projectId}`);
    });

    socket.on('leave:project', (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('timer:pause', (data) => {
      logger.info(`WS user:${socket.userId} paused timer ${data?.itemId}`);
      io.to(`user:${socket.userId}`).emit('timer:paused', data);
    });

    socket.on('timer:resume', (data) => {
      logger.info(`WS user:${socket.userId} resumed timer ${data?.itemId}`);
      io.to(`user:${socket.userId}`).emit('timer:resumed', data);
    });

    socket.on('disconnect', () => {
      logger.info(`WS disconnected: ${socket.id}`);
    });
  });

  return io;
};

/** Broadcast a Kanban event to every client in the project room. */
const broadcast = (projectId, event, payload) => {
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, payload);
};

const getIO = () => io;

module.exports = { init, broadcast, getIO };
