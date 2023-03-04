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

io.on('connection', (socket) => {
  console.log('New client connected!');
  socket.send(socket.id);

  socket.on("message", (data) => {
    console.log(data);
  });

  socket.on('close', () => {
    console.log('Client has disconnected!');
    });

  socket.on("private message", (anotherSocketId, msg) => {
    console.log("Private message from " + socket.id +  " to " + anotherSocketId + ": " + msg);
    socket.to(anotherSocketId).emit("private message", socket.id, msg);
  });

  socket.on("join room", (roomId) => {
    console.log("Request from: " + socket.id + " to join room Id " + roomId);
    socket.join(roomId);
    io.to(roomId).emit("message", socket.id + " has joined the room!");
  });

  socket.on("broadcast", (roomId, msg) => {
    console.log("broadcast from: " + socket.id + " to room Id " + roomId);
    io.to(roomId).emit("message", msg);
  });
});

httpServer.listen(8000);
console.log("Now listening on port 8000");