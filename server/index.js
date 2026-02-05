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
            time: new Date().toLocaleTimeString()
        };

        // gửi cho tất cả
        io.emit("receive-message", message);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(8000, () => {
    console.log("Server running at http://localhost:8000");
});
