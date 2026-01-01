const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    socket.on("chat-message", msg => {
        console.log("got mess")
        io.emit("chat-message", msg);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(8000, () => {
    console.log("Server running on http://localhost:8000");
});
