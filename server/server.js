const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const onlineUsers = new Map(); // socketId => username

io.on('connection', (socket) => {
  console.log('⚡ A user connected:', socket.id);

  socket.on('newUser', (username) => {
    socket.username = username;
    onlineUsers.set(socket.id, username);
    io.emit('updateUsers', Array.from(new Set(onlineUsers.values())));
  });

  socket.on('joinRoom', (room) => {
    socket.join(room);
    socket.currentRoom = room;
    socket.to(room).emit('message', {
      user: 'System',
      text: `${socket.username} joined ${room}`,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('roomMessage', (data) => {
    if (socket.currentRoom) {
      io.to(socket.currentRoom).emit('message', data);
    }
  });

  socket.on('privateMessage', ({ to, ...message }) => {
    const recipientSocketId = [...onlineUsers.entries()].find(([id, name]) => name === to)?.[0];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('privateMessage', { ...message, from: socket.username });
    }
  });

  socket.on('typing', (username) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('typing', username);
    }
  });

  socket.on('stopTyping', () => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('stopTyping');
    }
  });

  socket.on('readMessage', ({ from }) => {
    const senderSocketId = [...onlineUsers.entries()].find(([id, name]) => name === from)?.[0];
    if (senderSocketId) {
      io.to(senderSocketId).emit('messageRead', {
        by: socket.username,
        time: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on('reactToMessage', ({ id, emoji, room }) => {
    if (room) {
      io.to(room).emit('messageReaction', { id, emoji });
    }
  });

  socket.on('disconnect', () => {
    const name = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    io.emit('updateUsers', Array.from(new Set(onlineUsers.values())));
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('message', {
        user: 'System',
        text: `${name} left ${socket.currentRoom}`,
        time: new Date().toLocaleTimeString()
      });
    }
    console.log('❌ Disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('✅ Socket.io server running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

