const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

function makeCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", socket => {

  socket.on("createRoom", () => {
    let code = makeCode();
    rooms[code] = {
      players: [],
      game: null,
      admin: null,
      winCondition: 10,
      map: 'map1'
    };

    socket.room = code;
    socket.join(code);

    socket.emit("roomCreated", code);
  });

  socket.on("joinRoom", ({ code, name }) => {
    let room = rooms[code];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }
    if (room.players.length >= 4) {
      socket.emit("error", "Room is full");
      return;
    }

    socket.room = code;
    socket.name = name || "Player";

    // First player to join becomes admin
    const isAdmin = room.players.length === 0;
    if (isAdmin) {
      room.admin = socket.id;
    }

    room.players.push({
      id: socket.id,
      name: socket.name,
      ready: false,
      isAdmin: isAdmin,
      kills: 0,
      deaths: 0
    });

    socket.join(code);

    // Send player their admin status
    socket.emit("adminStatus", isAdmin);

    io.to(code).emit("lobbyUpdate", room.players);
  });

  socket.on("ready", () => {
    let room = rooms[socket.room];
    if (!room) return;

    let p = room.players.find(p => p.id === socket.id);
    if (!p) return;

    p.ready = true;

    io.to(socket.room).emit("lobbyUpdate", room.players);
  });

  socket.on("unready", () => {
    let room = rooms[socket.room];
    if (!room) return;

    let p = room.players.find(p => p.id === socket.id);
    if (!p) return;

    p.ready = false;

    io.to(socket.room).emit("lobbyUpdate", room.players);
  });

  socket.on("startGame", game => {
    let room = rooms[socket.room];
    if (!room) return;

    // Only admin can start games
    if (room.admin !== socket.id) {
      socket.emit("error", "Only admin can start games");
      return;
    }

    // Check if all players are ready
    const unreadyPlayers = room.players.filter(p => !p.ready);
    if (unreadyPlayers.length > 0) {
      const names = unreadyPlayers.map(p => p.name).join(", ");
      const msg = `Wait! ${names} ${unreadyPlayers.length > 1 ? 'are' : 'is'} not ready yet. Please be ready!`;
      io.to(socket.room).emit("gameStartError", msg);
      return;
    }

    // Reset scores for new game and sync
    room.players.forEach(p => { p.kills = 0; p.deaths = 0; });

    room.game = game;

    io.to(socket.room).emit("setGame", {
      game,
      players: room.players,
      winCondition: room.winCondition,
      map: room.map
    });
    io.to(socket.room).emit("scoreUpdate", room.players);
  });

  socket.on("updateSettings", settings => {
    let room = rooms[socket.room];
    if (!room || room.admin !== socket.id) return;
    if (settings.winCondition !== undefined) {
      room.winCondition = settings.winCondition;
    }
    let mapChanged = false;
    if (settings.map !== undefined && settings.map !== room.map) {
      room.map = settings.map;
      mapChanged = true;
    }
    io.to(socket.room).emit("lobbyUpdate", room.players);
    // Also notify about settings update
    io.to(socket.room).emit("settingsUpdated", { winCondition: room.winCondition, map: room.map });

    // If map changed while in game, force a reload for everyone
    if (mapChanged && room.game) {
      // Reset scores for the new map
      room.players.forEach(p => { p.kills = 0; p.deaths = 0; });
      io.to(socket.room).emit("setGame", {
        game: room.game,
        players: room.players,
        winCondition: room.winCondition,
        map: room.map
      });
      io.to(socket.room).emit("scoreUpdate", room.players);
    }
  });

  socket.on("reportKill", (payload) => {
    let room = rooms[socket.room];
    if (!room) return;

    // Correctly identify both from payload
    const killer = room.players.find(p => p.id === payload.killerId);
    const victim = room.players.find(p => p.id === payload.victimId);

    if (killer) killer.kills++;
    if (victim) victim.deaths++;

    io.to(socket.room).emit("scoreUpdate", room.players);

    if (killer && killer.kills >= room.winCondition) {
      io.to(socket.room).emit("gameOver", { winner: killer.name, killerId: killer.id });
    }
  });

  socket.on("restartGame", () => {
    let room = rooms[socket.room];
    if (!room) return;

    // Only admin can restart
    if (room.admin !== socket.id) return;

    if (room.game) {
      // Reset scores and sync
      room.players.forEach(p => { p.kills = 0; p.deaths = 0; });

      io.to(socket.room).emit("setGame", {
        game: room.game,
        players: room.players,
        winCondition: room.winCondition,
        map: room.map
      });
      io.to(socket.room).emit("scoreUpdate", room.players);
    }
  });

  socket.on("exitGame", () => {
    let room = rooms[socket.room];
    if (!room) return;

    // Only admin can exit to lobby
    if (room.admin !== socket.id) return;

    room.game = null;

    // Reset ready status
    room.players.forEach(p => p.ready = false);

    io.to(socket.room).emit("returnToLobby", room.players);
  });

  socket.on("input", data => {
    if (!socket.room) return;

    socket.to(socket.room).emit("input", {
      player: socket.id,
      name: socket.name,
      data
    });
  });

  socket.on("disconnect", () => {
    let room = rooms[socket.room];
    if (!room) return;

    const wasAdmin = room.admin === socket.id;
    room.players = room.players.filter(p => p.id !== socket.id);

    // If admin left, assign new admin to first player
    if (wasAdmin && room.players.length > 0) {
      room.admin = room.players[0].id;
      room.players[0].isAdmin = true;

      // Notify the new admin
      io.to(room.players[0].id).emit("adminStatus", true);
    }

    io.to(socket.room).emit("lobbyUpdate", room.players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));