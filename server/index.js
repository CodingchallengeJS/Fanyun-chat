// server/index.js

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Or your client's port
    methods: ["GET", "POST"]
  }
});

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // When a user sends a message
    socket.on("send-message", data => {
        // Create a rich message object
        const message = {
            id: `${socket.id}-${Date.now()}`, // Create a unique ID
            user: data.user,
            text: data.text,
            timestamp: data.timestamp || Date.now(),
            status: 'sent' // Start with a 'sent' status
        };
        
        // Send the complete message object to all clients
        io.emit("receive-message", message);
    });

    // When a message is seen by another user
    socket.on("message-seen", data => {
        // Broadcast to everyone that a specific message's status has changed
        io.emit("message-status-changed", { id: data.id, status: 'seen' });
    });

    socket.on("typing", data => {
        socket.broadcast.emit("user-typing", data);
    });

    socket.on("stop-typing", data => {
        socket.broadcast.emit("user-stop-typing", data);
    });
    
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(8000, () => {
    console.log("Server running at http://localhost:8000");
});