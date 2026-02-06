const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve frontend
app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    socket.on("send-message", data => {
        const message = {
            user: data.user,
            text: data.text,
            timestamp: data.timestamp || Date.now()
        };
        console.log(message.time);
        // gửi cho tất cả
        io.emit("receive-message", message);
    });

    socket.on("typing", data => {
        socket.broadcast.emit("user-typing", data);
    });

    socket.on("stop-typing", data => {
        socket.broadcast.emit("user-stop-typing", data);
    });

    socket.on("message-seen", data => {
        socket.broadcast.emit("message-seen", data);
    });
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(8000, () => {
    console.log("Server running at http://localhost:8000");
});
