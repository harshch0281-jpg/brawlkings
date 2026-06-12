const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let gameStarted = false;

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  const playerCount = Object.keys(players).length;

  if (playerCount >= 4) {
    socket.emit('roomFull');
    return;
  }

  players[socket.id] = {
    id: playerCount,
    x: [80, 700, 300, 500][playerCount],
    y: 320,
    hp: 100,
    dead: false,
    vx: 0,
    vy: 0,
    facing: playerCount < 2 ? 1 : -1,
    state: 'idle',
  };

  io.emit('playersUpdate', players);

  if (Object.keys(players).length >= 2) {
    gameStarted = true;
    io.emit('gameStart', players);
  }

  socket.on('playerInput', (input) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...input };
      io.emit('playersUpdate', players);
    }
  });

  socket.on('playerAttack', (data) => {
    io.emit('playerAttack', { attackerId: socket.id, ...data });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    gameStarted = false;
    io.emit('playerLeft', socket.id);
    io.emit('playersUpdate', players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log("Brawl Kings running on port " + PORT);
});