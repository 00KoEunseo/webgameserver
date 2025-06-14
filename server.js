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

const players = {};      // socket.id → { x, y, anim, flipX, scene }

io.on('connection', (socket) => {
  console.log('✅ 연결:', socket.id);

  players[socket.id] = {
    x: 400,
    y: 300,
    anim: 'idle',
    flipX: false,
    scene: null  // 초기 씬 없음
  };

  // 씬 정보 설정
  socket.on('set_scene', (sceneName) => {
    const prevScene = players[socket.id]?.scene;

    if (prevScene && prevScene !== sceneName) {
      // 이전 씬 유저들에게 이 플레이어 제거 알림
      for (const [id, info] of Object.entries(players)) {
        if (info.scene === prevScene && id !== socket.id) {
          io.to(id).emit('playerDisconnected', socket.id);
        }
      }
    }

    players[socket.id].scene = sceneName;
    console.log(`🌍 ${socket.id} → ${sceneName}`);
  });

  // 현재 씬 플레이어 목록 요청
  socket.on('requestCurrentPlayers', (sceneName) => {
    const filtered = {};
    for (const [id, info] of Object.entries(players)) {
      if (info.scene === sceneName && id !== socket.id) {
        filtered[id] = info;
      }
    }
    socket.emit('currentPlayers', filtered);
  });

  // 새 유저 등장 알림 (씬 내 다른 유저에게만)
  socket.on('newPlayerReady', (sceneName) => {
    const playerData = { id: socket.id, ...players[socket.id] };
    for (const [id, info] of Object.entries(players)) {
      if (id !== socket.id && info.scene === sceneName) {
        io.to(id).emit('newPlayer', playerData);
      }
    }
  });

  // 이동 동기화 (씬 내 유저에게만)
    socket.on('playerMovement', (movementData) => {
    if (!players[socket.id]) return;

    // 기존 기본 데이터 병합
    players[socket.id] = { ...players[socket.id], ...movementData };

    const currentScene = players[socket.id].scene;
    for (const [id, info] of Object.entries(players)) {
        if (id !== socket.id && info.scene === currentScene) {
        io.to(id).emit('playerMoved', { id: socket.id, ...players[socket.id] });
        }
    }
    });

  // 연결 종료
  socket.on('disconnect', () => {
    console.log('❌ 연결 종료:', socket.id);
    const scene = players[socket.id]?.scene;
    delete players[socket.id];

    // 해당 씬에만 제거 이벤트 알림
    if (scene) {
      for (const [id, info] of Object.entries(players)) {
        if (info.scene === scene) {
          io.to(id).emit('playerDisconnected', socket.id);
        }
      }
    }
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 서버가 ${PORT}번 포트에서 실행 중`);
});
