const requestListener = function (req, res) {
    res.writeHead(200);
    res.end("acknowledge");
};

const httpServer = require("http").createServer(requestListener);
const io = require("socket.io")(httpServer, {
  cors: {
    // origin: "https://multiplayer-chess-game.onrender.com",
    origin: "*",
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling'],
    credentials: true
  },
  allowEIO3: true
});

const generateRandomString = (myLength) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomArray = Array.from(
    { length: myLength },
    (v, k) => chars[Math.floor(Math.random() * chars.length)]
  );

  const randomString = randomArray.join("");
  return randomString;
};
var usernames = {};
var games = {}

io.on('connection', (socket) => {
  console.log('New client connected!');
  socket.emit("connect_ack");
  //assign random room ID
  const defaultRoomID = generateRandomString(5);
  socket.join(defaultRoomID);
  // socket.leave(socket.id);

  socket.emit("message", "Server", "Connected to server in room " + defaultRoomID);

  var users = io.sockets.adapter.rooms.get(defaultRoomID);
  if (typeof users === 'undefined') {
    users = []
  }
  socket.emit("ack", defaultRoomID, users.size);

  socket.on('close', () => {
    console.log('Client has disconnected!');
    });

  socket.on("join room", (roomId) => {
    console.log("Request from user: " + usernames[socket.id] + " to join room Id " + roomId);
    var users = io.sockets.adapter.rooms.get(roomId);
    if (typeof users === 'undefined') {
      users = [];
    }
    else {
      socket.emit("message", "Server", "List of " + users.size + (users.size === 1 ? " user":" users") + " in room:")
      users.forEach((user) => (socket.emit("message", "Server", usernames[user])));
    }
    if (users.length === 0 || (users.size < 2 && !users.has(socket.id))){
      socket.rooms.forEach((room) => {
        if (room !== socket.id) socket.leave(room);
      });
      socket.join(roomId);
      io.to(roomId).emit("message", "Server", usernames[socket.id] + " has joined the room!");
      users = io.sockets.adapter.rooms.get(roomId);
      if (typeof users === 'undefined') {
        users = []
      }
      io.to(roomId).emit("ack", roomId, users.size);
      socket.emit("join_success");
    } else {
      if (users.has(socket.id)) {
        socket.emit("message", "Server", "User " + usernames[socket.id] + " is already in room " + roomId);
        socket.emit("join_fail");
        socket.emit("ack", roomId, users.size);
      } else {
        socket.emit("message", "Server", "Room " + roomId + " is full");
        socket.emit("join_fail");
      }
    }
  });

  socket.on("registerUsername", (username) => {
    usernames[socket.id] = username;
    console.log("Username changed for user " + socket.id + ": " + usernames[socket.id]);
  });

  socket.on("broadcast", (roomId, msg) => {
    console.log("broadcast from: " + usernames[socket.id] + " to room Id " + roomId);
    var users = io.sockets.adapter.rooms.get(roomId);
    if (typeof users === 'undefined') {
      users = []
    }
    if (users.has(socket.id)) socket.to(roomId).emit("message", usernames[socket.id], msg);
    else socket.emit("message", "Server", "Can't broadcast to a room you aren't in");
  });

  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });

  socket.on("forfeit", () => {
    console.log("Forfeit from: " + usernames[socket]);
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        io.to(room).emit("end_game", (games[room].players[socket.id]) === "White" ? "Black" : "White");
      }
    });
  });

  socket.on("get_move_list", () => {
    console.log("Sending move list to " + usernames[socket.id]);
    console.log(games[room].moves);
    socket.emit("send_move_list", games[room].moves);
  });

  socket.on("add_move", (move) => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        if (games[room].players[socket.id] === games[room].activePlayer) {
          move.player = games[room].players[socket.id];
          console.log("Adding move to list: " + JSON.stringify(move));
          games[room].moves.push(move);
          games[room].activePlayer = (games[room].activePlayer) === "White" ? "Black" : "White";
          io.to(room).emit("send_move_list", games[room].moves, games[room].activePlayer);
        }
      }
    });
  });

  socket.on("start_game", () => {
    console.log("Request to start game from " + usernames[socket.id]);
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        games[room] = {players : {}, moves : []};
        var users = io.sockets.adapter.rooms.get(room);
        users.forEach((user) => {
          if (user === socket.id) {
            games[room].players[user] = "White";
            io.to(user).emit("start_game", "White");
          }
          else {
            games[room].players[user] = "Black";
            io.to(user).emit("start_game", "Black");
          }
        });
        games[room].activePlayer = "White";
      }
    });
  });

  socket.on("disconnecting", () => {
    console.log(socket.id + " has disconnected");
    // socket.emit("disconnecting");
    socket.rooms.forEach((room) => {
      socket.to(room).emit("message", "Server", usernames[socket.id] + " has disconnected");
      var users = io.sockets.adapter.rooms.get(room);
      if (typeof users === 'undefined') {
        users = []
      }
      socket.leave(room);
      socket.to(room).emit("ack", room, users.size);
    });
    usernames[socket.id] = '';
  });
});


httpServer.listen(8000);
console.log("Now listening on port 8000");