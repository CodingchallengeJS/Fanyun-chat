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

const GLOBAL_CHAT_TITLE = 'Global Chat';
let globalConversationId = null;
let globalConversationInit = null;

async function getGlobalConversationId() {
  if (globalConversationId) return globalConversationId;
  if (!globalConversationInit) {
    globalConversationInit = (async () => {
      const existing = await db.query(
        'SELECT id FROM conversations WHERE type = $1 AND title = $2 LIMIT 1',
        ['group', GLOBAL_CHAT_TITLE]
      );
      if (existing.rows.length > 0) {
        return existing.rows[0].id;
      }
      const created = await db.query(
        `INSERT INTO conversations (type, title, avatar_url, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['group', GLOBAL_CHAT_TITLE, null, null]
      );
      return created.rows[0].id;
    })();
  }
  globalConversationId = await globalConversationInit;
  return globalConversationId;
}

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

app.get('/api/conversations/global/messages', async (req, res) => {
  const limitRaw = req.query.limit;
  const limit = Number.isInteger(Number(limitRaw)) ? Math.max(1, Math.min(500, Number(limitRaw))) : 200;
  try {
    const conversationId = await getGlobalConversationId();
    const { rows } = await db.query(
      `SELECT m.id, m.content, m.created_at, a.username, a.id AS user_id
       FROM messages m
       JOIN accounts a ON a.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    const messages = rows.map(row => ({
      id: row.id,
      user: row.username,
      userId: row.user_id,
      text: row.content,
      timestamp: new Date(row.created_at).getTime(),
      status: 'sent'
    }));

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://fanyun-chat.vercel.app"
    ], // Or your client's port
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // When a user sends a message
    socket.on("send-message", async data => {
        const text = (data && data.text ? String(data.text) : '').trim();
        const username = data && data.user ? String(data.user) : 'Unknown';
        const userId = data && data.userId ? Number(data.userId) : null;

        if (!text) {
          return;
        }

        try {
          if (userId) {
            const conversationId = await getGlobalConversationId();
            const { rows } = await db.query(
              `INSERT INTO messages (conversation_id, sender_id, content)
               VALUES ($1, $2, $3)
               RETURNING id, created_at`,
              [conversationId, userId, text]
            );
            const saved = rows[0];
            const message = {
              id: saved.id,
              user: username,
              userId,
              text,
              timestamp: new Date(saved.created_at).getTime(),
              status: 'sent'
            };
            io.emit("receive-message", message);
            return;
          }
        } catch (error) {
          console.error('Save message error:', error);
        }

        // Fallback: emit without persisting (e.g., guest users)
        const message = {
          id: `${socket.id}-${Date.now()}`,
          user: username,
          text,
          timestamp: data && data.timestamp ? data.timestamp : Date.now(),
          status: 'sent'
        };
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
