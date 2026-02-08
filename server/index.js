// server/index.js

require('dotenv').config(); 
const jwt = require('jsonwebtoken');
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require('bcrypt'); // 1. Import bcrypt
const db = require('./db'); // 2. Import your database module

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  console.log("received a create account request: " + req.body);
  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }

  try {
    // 4. Hash the password before storing it
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Save the new user to the database
    const newUserQuery = `
      INSERT INTO accounts (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at;
    `;
    const values = [username, email, passwordHash];
    
    const { rows } = await db.query(newUserQuery, values);
    const newUser = rows[0];

    // Send a success response
    res.status(201).json({ 
      message: 'User created successfully!',
      user: newUser
    });

  } catch (error) {
    // Handle potential errors, like a duplicate username or email
    if (error.code === '23505') { // PostgreSQL unique violation error code
      return res.status(409).json({ message: 'Username or email already exists.' });
    }
    
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // 1. Find the user by email
    const userQuery = 'SELECT * FROM accounts WHERE email = $1';
    const { rows } = await db.query(userQuery, [email]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = rows[0];

    // 2. Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    
    // 3. (Optional but recommended) Generate a JWT token for session management
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'your_default_secret', {
      expiresIn: '24h',
    });

    // 4. Send back user info (without the password hash)
    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token // Send the token to the client
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

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