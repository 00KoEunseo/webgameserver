const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const players = {};      // socket.id → { x, y, anim, scene }
const socketScenes = {}; // socket.id → sceneName

io.on('connection', (socket) => {
  console.log('✅ 연결:', socket.id);

  players[socket.id] = {
    x: 400, y: 300, anim: 'idle', flipX: false,
    scene: null  // 초기에는 씬 없음
  };

  // 1️⃣ 씬 정보 설정
  socket.on('set_scene', (sceneName) => {
    const prevScene = players[socket.id]?.scene;

    // 씬이 바뀌었다면, 이전 씬 유저들에게 제거 알림
    if (prevScene && prevScene !== sceneName) {
      for (const [id, info] of Object.entries(players)) {
        if (info.scene === prevScene && id !== socket.id) {
          io.to(id).emit('playerDisconnected', socket.id);
        }
      }
    }

    players[socket.id].scene = sceneName;
    socketScenes[socket.id] = sceneName;
    console.log(`🌍 ${socket.id} → ${sceneName}`);
  });

  // 2️⃣ 현재 씬 플레이어 목록 전송
  socket.on('requestCurrentPlayers', (sceneName) => {
    const filtered = {};
    for (const [id, info] of Object.entries(players)) {
      if (info.scene === sceneName && id !== socket.id) {
        filtered[id] = info;
      }
    }
    socket.emit('currentPlayers', filtered);
  });

  // 3️⃣ 새 유저를 같은 씬 유저들에게만 알림
  socket.on('newPlayerReady', (sceneName) => {
    const playerData = { id: socket.id, ...players[socket.id] };
    for (const [id, info] of Object.entries(players)) {
      if (id !== socket.id && info.scene === sceneName) {
        io.to(id).emit('newPlayer', playerData);
      }
    }
  });

  // 4️⃣ 이동 시 같은 씬에만 브로드캐스트
  socket.on('playerMovement', (movementData) => {
    if (!players[socket.id]) return;
    players[socket.id] = { ...players[socket.id], ...movementData };

    const currentScene = players[socket.id].scene;
    for (const [id, info] of Object.entries(players)) {
      if (id !== socket.id && info.scene === currentScene) {
        io.to(id).emit('playerMoved', { id: socket.id, ...players[socket.id] });
      }
    }
  });

  // 5️⃣ 연결 종료 시 모든 씬에서 제거
  socket.on('disconnect', () => {
    console.log('❌ 연결 종료:', socket.id);
    delete players[socket.id];
    delete socketScenes[socket.id];
    io.emit('playerDisconnected', socket.id); // 전부에게
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 서버가 ${PORT}번 포트에서 실행 중`);
});
