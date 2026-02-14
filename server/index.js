// server/index.js

require('dotenv').config(); 
const jwt = require('jsonwebtoken');
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require('bcrypt'); // 1. Import bcrypt
const { v2: cloudinary } = require('cloudinary');
const db = require('./db'); // 2. Import your database module

const BCRYPT_ROUNDS = Number.isInteger(Number(process.env.BCRYPT_ROUNDS))
  ? Math.max(10, Number(process.env.BCRYPT_ROUNDS))
  : 12;
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || '';
const JWT_SECRET = process.env.JWT_SECRET;

function normalizePasswordInput(rawPassword) {
  return `${String(rawPassword || '')}${PASSWORD_PEPPER}`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const GLOBAL_CHAT_TITLE = 'Global Chat';
let globalConversationId = null;
let globalConversationInit = null;

async function ensureSocialTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_id INT REFERENCES accounts(id),
      friend_id INT REFERENCES accounts(id),
      status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'accepted',
      requested_by INT REFERENCES accounts(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id),
      CHECK (user_id < friend_id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INT REFERENCES posts(id) ON DELETE CASCADE,
      author_id INT REFERENCES accounts(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_comments_post_created
      ON comments(post_id, created_at ASC);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_reactions_target
      ON reactions(target_type, target_id);
  `);

  await db.query(`
    INSERT INTO reaction_types (id, name)
    VALUES
      (1, 'like'),
      (2, 'love'),
      (3, 'haha'),
      (4, 'wow'),
      (5, 'sad'),
      (6, 'angry')
    ON CONFLICT (id) DO NOTHING;
  `);
}

function normalizeFriendPair(a, b) {
  const x = Number(a);
  const y = Number(b);
  return x < y ? [x, y] : [y, x];
}

async function getAcceptedFriendIds(userId) {
  const uid = Number(userId);
  const { rows } = await db.query(
    `SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS friend_id
     FROM friendships
     WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
    [uid]
  );
  return rows.map((row) => Number(row.friend_id));
}

async function loadPostInteractionSnapshot(postIds, viewerId) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    return { reactionCountByPost: new Map(), commentCountByPost: new Map(), viewerReactionByPost: new Map() };
  }

  const reactionCountResult = await db.query(
    `SELECT target_id::int AS post_id, COUNT(*)::int AS count
     FROM reactions
     WHERE target_type = 'post' AND target_id = ANY($1::int[])
     GROUP BY target_id`,
    [postIds]
  );

  const commentCountResult = await db.query(
    `SELECT post_id::int, COUNT(*)::int AS count
     FROM comments
     WHERE post_id = ANY($1::int[])
     GROUP BY post_id`,
    [postIds]
  );

  const viewerReactionResult = await db.query(
    `SELECT r.target_id::int AS post_id, rt.name AS reaction_name
     FROM reactions r
     JOIN reaction_types rt ON rt.id = r.reaction_type_id
     WHERE r.user_id = $1
       AND r.target_type = 'post'
       AND r.target_id = ANY($2::int[])`,
    [viewerId, postIds]
  );

  const reactionCountByPost = new Map(
    reactionCountResult.rows.map((row) => [Number(row.post_id), Number(row.count)])
  );
  const commentCountByPost = new Map(
    commentCountResult.rows.map((row) => [Number(row.post_id), Number(row.count)])
  );
  const viewerReactionByPost = new Map(
    viewerReactionResult.rows.map((row) => [Number(row.post_id), row.reaction_name])
  );

  return { reactionCountByPost, commentCountByPost, viewerReactionByPost };
}

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

app.post('/api/posts', async (req, res) => {
  const authorId = Number(req.body.authorId);
  const content = (req.body.content || '').trim();

  if (!authorId || !content) {
    return res.status(400).json({ message: 'authorId and content are required.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO posts (author_id, content)
       VALUES ($1, $2)
       RETURNING id, author_id, content, created_at`,
      [authorId, content]
    );

    const inserted = rows[0];
    const authorResult = await db.query(
      'SELECT username, avatar_url FROM accounts WHERE id = $1',
      [authorId]
    );

    res.status(201).json({
      post: {
        id: inserted.id,
        content: inserted.content,
        createdAt: inserted.created_at,
        author: {
          id: inserted.author_id,
          username: authorResult.rows[0]?.username || 'Unknown',
          avatarUrl: authorResult.rows[0]?.avatar_url || null
        },
        isFriend: false,
        reactionCount: 0,
        commentCount: 0,
        viewerReactionType: null,
        viewerHasReacted: false
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/feed', async (req, res) => {
  const viewerId = Number(req.query.viewerId);
  const limitRaw = Number(req.query.limit);
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;

  if (!viewerId) {
    return res.status(400).json({ message: 'viewerId is required.' });
  }

  try {
    const friendIds = await getAcceptedFriendIds(viewerId);
    const friendLimit = friendIds.length > 0 ? Math.max(10, Math.floor(limit * 0.75)) : 0;
    const strangerLimit = friendIds.length > 0 ? Math.max(3, limit - friendLimit) : limit;
    const friendIdSet = new Set(friendIds);
    let friendPosts = [];
    let strangerPosts = [];

    if (friendIds.length > 0) {
      const friendResult = await db.query(
        `SELECT p.id, p.content, p.created_at, a.id AS author_id, a.username, a.avatar_url
         FROM posts p
         JOIN accounts a ON a.id = p.author_id
         WHERE p.author_id = ANY($1::int[])
         ORDER BY p.created_at DESC
         LIMIT $2`,
        [friendIds, friendLimit]
      );
      friendPosts = friendResult.rows;

      const strangerResult = await db.query(
        `SELECT p.id, p.content, p.created_at, a.id AS author_id, a.username, a.avatar_url
         FROM posts p
         JOIN accounts a ON a.id = p.author_id
         WHERE p.author_id <> $1
           AND NOT (p.author_id = ANY($2::int[]))
         ORDER BY RANDOM()
         LIMIT $3`,
        [viewerId, friendIds, strangerLimit]
      );
      strangerPosts = strangerResult.rows;
    } else {
      const strangerOnlyResult = await db.query(
        `SELECT p.id, p.content, p.created_at, a.id AS author_id, a.username, a.avatar_url
         FROM posts p
         JOIN accounts a ON a.id = p.author_id
         WHERE p.author_id <> $1
         ORDER BY p.created_at DESC
         LIMIT $2`,
        [viewerId, limit]
      );
      strangerPosts = strangerOnlyResult.rows;
    }

    const postRows = [...friendPosts, ...strangerPosts]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    const postIds = postRows.map((row) => Number(row.id));
    const { reactionCountByPost, commentCountByPost, viewerReactionByPost } =
      await loadPostInteractionSnapshot(postIds, viewerId);

    const posts = postRows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          username: row.username,
          avatarUrl: row.avatar_url
        },
        isFriend: friendIdSet.has(Number(row.author_id)),
        reactionCount: reactionCountByPost.get(Number(row.id)) || 0,
        commentCount: commentCountByPost.get(Number(row.id)) || 0,
        viewerReactionType: viewerReactionByPost.get(Number(row.id)) || null,
        viewerHasReacted: viewerReactionByPost.has(Number(row.id))
      }));

    res.status(200).json({
      hasFriends: friendIds.length > 0,
      posts
    });
  } catch (error) {
    console.error('Fetch feed error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/posts/:id/reactions', async (req, res) => {
  const postId = Number(req.params.id);
  const userId = Number(req.body.userId);
  const reactionType = String(req.body.reactionType || 'like').toLowerCase().trim();

  if (!postId || !userId) {
    return res.status(400).json({ message: 'post id and userId are required.' });
  }

  try {
    const [postResult, accountResult, reactionTypeResult] = await Promise.all([
      db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]),
      db.query('SELECT id FROM accounts WHERE id = $1 LIMIT 1', [userId]),
      db.query('SELECT id, name FROM reaction_types WHERE name = $1 LIMIT 1', [reactionType])
    ]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (reactionTypeResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid reaction type.' });
    }

    const reactionTypeId = reactionTypeResult.rows[0].id;

    const existing = await db.query(
      `SELECT reaction_type_id
       FROM reactions
       WHERE user_id = $1 AND target_type = 'post' AND target_id = $2
       LIMIT 1`,
      [userId, postId]
    );

    let viewerReactionType = reactionType;
    let viewerHasReacted = true;

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO reactions (user_id, target_type, target_id, reaction_type_id)
         VALUES ($1, 'post', $2, $3)`,
        [userId, postId, reactionTypeId]
      );
    } else if (Number(existing.rows[0].reaction_type_id) === Number(reactionTypeId)) {
      await db.query(
        `DELETE FROM reactions
         WHERE user_id = $1 AND target_type = 'post' AND target_id = $2`,
        [userId, postId]
      );
      viewerReactionType = null;
      viewerHasReacted = false;
    } else {
      await db.query(
        `UPDATE reactions
         SET reaction_type_id = $3, created_at = NOW()
         WHERE user_id = $1 AND target_type = 'post' AND target_id = $2`,
        [userId, postId, reactionTypeId]
      );
    }

    const reactionCountResult = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM reactions
       WHERE target_type = 'post' AND target_id = $1`,
      [postId]
    );

    return res.status(200).json({
      reactionCount: Number(reactionCountResult.rows[0]?.count || 0),
      viewerReactionType,
      viewerHasReacted
    });
  } catch (error) {
    console.error('Toggle post reaction error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/posts/:id/comments', async (req, res) => {
  const postId = Number(req.params.id);
  const limitRaw = Number(req.query.limit);
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;

  if (!postId) {
    return res.status(400).json({ message: 'post id is required.' });
  }

  try {
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const commentsResult = await db.query(
      `SELECT c.id, c.content, c.created_at, a.id AS author_id, a.username, a.avatar_url
       FROM comments c
       JOIN accounts a ON a.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT $2`,
      [postId, limit]
    );

    return res.status(200).json({
      comments: commentsResult.rows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          username: row.username,
          avatarUrl: row.avatar_url
        }
      }))
    });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  const postId = Number(req.params.id);
  const authorId = Number(req.body.authorId);
  const content = String(req.body.content || '').trim();

  if (!postId || !authorId || !content) {
    return res.status(400).json({ message: 'post id, authorId, and content are required.' });
  }

  try {
    const [postResult, authorResult] = await Promise.all([
      db.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [postId]),
      db.query('SELECT id, username, avatar_url FROM accounts WHERE id = $1 LIMIT 1', [authorId])
    ]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (authorResult.rows.length === 0) {
      return res.status(404).json({ message: 'Author not found.' });
    }

    const inserted = await db.query(
      `INSERT INTO comments (post_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [postId, authorId, content]
    );

    const commentCountResult = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM comments
       WHERE post_id = $1`,
      [postId]
    );

    return res.status(201).json({
      comment: {
        id: inserted.rows[0].id,
        content,
        createdAt: inserted.rows[0].created_at,
        author: {
          id: authorResult.rows[0].id,
          username: authorResult.rows[0].username,
          avatarUrl: authorResult.rows[0].avatar_url
        }
      },
      commentCount: Number(commentCountResult.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/users/discovery', async (req, res) => {
  const viewerId = Number(req.query.viewerId);
  const query = (req.query.query || '').trim();

  if (!viewerId) {
    return res.status(400).json({ message: 'viewerId is required.' });
  }

  try {
    if (!query) {
      const { rows } = await db.query(
        `SELECT a.id, a.username, a.email, a.avatar_url
         FROM friendships f
         JOIN accounts a
           ON a.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
         WHERE (f.user_id = $1 OR f.friend_id = $1)
           AND f.status = 'accepted'
         ORDER BY a.username ASC
         LIMIT 50`,
        [viewerId]
      );

      return res.status(200).json({
        users: rows.map((row) => ({
          id: row.id,
          username: row.username,
          email: row.email,
          avatarUrl: row.avatar_url,
          relation: 'friend'
        }))
      });
    }

    const searchTerm = `%${query}%`;
    const candidatesResult = await db.query(
      `SELECT id, username, email, avatar_url
       FROM accounts
       WHERE id <> $1
         AND (username ILIKE $2 OR email ILIKE $2)
       ORDER BY username ASC
       LIMIT 50`,
      [viewerId, searchTerm]
    );
    const candidates = candidatesResult.rows;

    if (candidates.length === 0) {
      return res.status(200).json({ users: [] });
    }

    const candidateIds = candidates.map((u) => u.id);
    const relationResult = await db.query(
      `SELECT user_id, friend_id, status
       FROM friendships
       WHERE (user_id = $1 AND friend_id = ANY($2::int[]))
          OR (friend_id = $1 AND user_id = ANY($2::int[]))`,
      [viewerId, candidateIds]
    );

    const relationMap = new Map();
    relationResult.rows.forEach((row) => {
      const otherId = row.user_id === viewerId ? row.friend_id : row.user_id;
      relationMap.set(Number(otherId), row.status === 'accepted' ? 'friend' : 'pending');
    });

    const users = candidates
      .map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        avatarUrl: row.avatar_url,
        relation: relationMap.get(Number(row.id)) || 'none'
      }))
      .sort((a, b) => {
        if (a.relation === b.relation) return a.username.localeCompare(b.username);
        if (a.relation === 'friend') return -1;
        if (b.relation === 'friend') return 1;
        return a.username.localeCompare(b.username);
      });

    return res.status(200).json({ users });
  } catch (error) {
    console.error('User discovery error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/api/users/:id/profile', async (req, res) => {
  const targetUserId = Number(req.params.id);
  const viewerId = Number(req.query.viewerId);

  if (!targetUserId || !viewerId) {
    return res.status(400).json({ message: 'target id and viewerId are required.' });
  }

  try {
    const userResult = await db.query(
      'SELECT id, username, email, avatar_url FROM accounts WHERE id = $1',
      [targetUserId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isSelf = targetUserId === viewerId;
    let friendshipStatus = isSelf ? 'self' : 'none';

    if (!isSelf) {
      const [u1, u2] = normalizeFriendPair(targetUserId, viewerId);
      const friendshipResult = await db.query(
        `SELECT status
         FROM friendships
         WHERE user_id = $1 AND friend_id = $2
         LIMIT 1`,
        [u1, u2]
      );
      if (friendshipResult.rows.length > 0) {
        friendshipStatus = friendshipResult.rows[0].status === 'accepted' ? 'friend' : 'pending';
      }
    }

    const postsResult = await db.query(
      `SELECT id, content, created_at
       FROM posts
       WHERE author_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [targetUserId]
    );

    const postRows = postsResult.rows;
    const postIds = postRows.map((row) => Number(row.id));
    const { reactionCountByPost, commentCountByPost, viewerReactionByPost } =
      await loadPostInteractionSnapshot(postIds, viewerId);

    return res.status(200).json({
      user: {
        id: userResult.rows[0].id,
        username: userResult.rows[0].username,
        email: userResult.rows[0].email,
        avatarUrl: userResult.rows[0].avatar_url
      },
      friendshipStatus,
      posts: postRows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        reactionCount: reactionCountByPost.get(Number(row.id)) || 0,
        commentCount: commentCountByPost.get(Number(row.id)) || 0,
        viewerReactionType: viewerReactionByPost.get(Number(row.id)) || null,
        viewerHasReacted: viewerReactionByPost.has(Number(row.id))
      }))
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/friends/add', async (req, res) => {
  const fromUserId = Number(req.body.fromUserId);
  const toUserId = Number(req.body.toUserId);

  if (!fromUserId || !toUserId) {
    return res.status(400).json({ message: 'fromUserId and toUserId are required.' });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ message: 'Cannot add yourself.' });
  }

  try {
    const [u1, u2] = normalizeFriendPair(fromUserId, toUserId);
    await db.query(
      `INSERT INTO friendships (user_id, friend_id, status, requested_by)
       VALUES ($1, $2, 'accepted', $3)
       ON CONFLICT (user_id, friend_id)
       DO UPDATE SET status = 'accepted', requested_by = EXCLUDED.requested_by, updated_at = NOW()`,
      [u1, u2, fromUserId]
    );

    res.status(200).json({ message: 'Friend added successfully.', status: 'friend' });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/friends/remove', async (req, res) => {
  const fromUserId = Number(req.body.fromUserId);
  const toUserId = Number(req.body.toUserId);

  if (!fromUserId || !toUserId) {
    return res.status(400).json({ message: 'fromUserId and toUserId are required.' });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ message: 'Cannot unfriend yourself.' });
  }

  try {
    const [u1, u2] = normalizeFriendPair(fromUserId, toUserId);
    await db.query(
      `DELETE FROM friendships
       WHERE user_id = $1 AND friend_id = $2`,
      [u1, u2]
    );

    res.status(200).json({ message: 'Unfriended successfully.', status: 'none' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/chats/direct', async (req, res) => {
  const userId = Number(req.body.userId);
  const targetUserId = Number(req.body.targetUserId);

  if (!userId || !targetUserId) {
    return res.status(400).json({ message: 'userId and targetUserId are required.' });
  }
  if (userId === targetUserId) {
    return res.status(400).json({ message: 'Cannot create direct chat with yourself.' });
  }

  try {
    const existingResult = await db.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE c.type = 'direct'
         AND cm.user_id IN ($1, $2)
       GROUP BY c.id
       HAVING COUNT(DISTINCT cm.user_id) = 2
       LIMIT 1`,
      [userId, targetUserId]
    );

    let conversationId = existingResult.rows[0]?.id;

    if (!conversationId) {
      const created = await db.query(
        `INSERT INTO conversations (type, title, avatar_url, created_by)
         VALUES ('direct', NULL, NULL, $1)
         RETURNING id`,
        [userId]
      );
      conversationId = created.rows[0].id;

      await db.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, 'member'), ($1, $3, 'member')
         ON CONFLICT DO NOTHING`,
        [conversationId, userId, targetUserId]
      );
    }

    const targetUser = await db.query(
      'SELECT id, username, avatar_url FROM accounts WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    return res.status(200).json({
      conversation: {
        id: conversationId,
        type: 'direct',
        contact: {
          id: targetUser.rows[0]?.id || targetUserId,
          name: targetUser.rows[0]?.username || 'Unknown',
          avatarUrl: targetUser.rows[0]?.avatar_url || null
        }
      }
    });
  } catch (error) {
    console.error('Create/open direct chat error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }

  const normalizedPassword = String(password || '');
  if (normalizedPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(normalizePasswordInput(normalizedPassword), BCRYPT_ROUNDS);

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

    // 2. Compare password with current scheme first, then legacy (no pepper) for migration.
    const rawPassword = String(password || '');
    const pepperedPassword = normalizePasswordInput(rawPassword);
    let isPasswordValid = await bcrypt.compare(pepperedPassword, user.password_hash);
    let matchedLegacyWithoutPepper = false;

    if (!isPasswordValid && PASSWORD_PEPPER) {
      matchedLegacyWithoutPepper = await bcrypt.compare(rawPassword, user.password_hash);
      isPasswordValid = matchedLegacyWithoutPepper;
    }

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const currentRounds = bcrypt.getRounds(user.password_hash);
    const shouldUpgradeHash = matchedLegacyWithoutPepper || currentRounds < BCRYPT_ROUNDS;
    if (shouldUpgradeHash) {
      const upgradedHash = await bcrypt.hash(pepperedPassword, BCRYPT_ROUNDS);
      await db.query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [upgradedHash, user.id]);
    }
    
    // 3. (Optional but recommended) Generate a JWT token for session management
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not configured.');
      return res.status(500).json({ message: 'Server is not configured for authentication.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '24h',
    });

    // 4. Send back user info (without the password hash)
    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url || null
      },
      token // Send the token to the client
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/users/:id/avatar', async (req, res) => {
  const userId = Number(req.params.id);
  const imageData = typeof req.body.imageData === 'string' ? req.body.imageData : '';

  if (!userId || !imageData) {
    return res.status(400).json({ message: 'user id and imageData are required.' });
  }

  if (!imageData.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Invalid image format.' });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ message: 'Cloudinary is not configured on server.' });
  }

  try {
    const accountResult = await db.query('SELECT id FROM accounts WHERE id = $1 LIMIT 1', [userId]);
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const uploadResult = await cloudinary.uploader.upload(imageData, {
      folder: 'fanyun-chat',
      resource_type: 'image',
      public_id: `avatar-${userId}-${Date.now()}`
    });

    const avatarUrl = uploadResult.secure_url || uploadResult.url;
    await db.query('UPDATE accounts SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);

    return res.status(200).json({ avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ message: 'Failed to upload avatar.' });
  }
});

app.get('/api/conversations', async (req, res) => {
  const userId = Number(req.query.userId);

  if (!userId) {
    return res.status(400).json({ message: 'userId is required.' });
  }

  try {
    const conversationId = await getGlobalConversationId();
    const globalLastMessageResult = await db.query(
      `SELECT m.content, m.created_at, a.username
       FROM messages m
       JOIN accounts a ON a.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [conversationId]
    );

    const directResult = await db.query(
      `SELECT
         c.id AS conversation_id,
         c.created_at AS conversation_created_at,
         a.id AS contact_id,
         a.username AS contact_username,
         a.avatar_url AS contact_avatar_url,
         lm.content AS last_message,
         lm.sender_username AS last_message_sender_username,
         lm.created_at AS last_message_at
       FROM conversations c
       JOIN conversation_members cms
         ON cms.conversation_id = c.id AND cms.user_id = $1
       JOIN conversation_members cmo
         ON cmo.conversation_id = c.id AND cmo.user_id <> $1
       JOIN accounts a
         ON a.id = cmo.user_id
       LEFT JOIN LATERAL (
         SELECT m.content, m.created_at, s.username AS sender_username
         FROM messages m
         JOIN accounts s ON s.id = m.sender_id
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       WHERE c.type = 'direct'
       ORDER BY COALESCE(lm.created_at, c.created_at) DESC
       LIMIT 100`,
      [userId]
    );

    const globalLast = globalLastMessageResult.rows[0];
    const conversations = [
      {
        id: 'global-chat-01',
        type: 'group',
        conversationId,
        name: GLOBAL_CHAT_TITLE,
        avatarUrl: null,
        lastMessage: globalLast
          ? `${globalLast.username}: ${globalLast.content}`
          : 'Welcome to the chat!',
        updatedAt: globalLast?.created_at || null
      },
      ...directResult.rows.map((row) => ({
        id: `direct-${row.conversation_id}`,
        type: 'direct',
        conversationId: row.conversation_id,
        contactUserId: row.contact_id,
        name: row.contact_username,
        avatarUrl: row.contact_avatar_url,
        lastMessage: row.last_message
          ? `${row.last_message_sender_username}: ${row.last_message}`
          : 'No messages yet.',
        updatedAt: row.last_message_at || row.conversation_created_at
      }))
    ];

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
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

app.get('/api/conversations/:id/messages', async (req, res) => {
  const conversationId = Number(req.params.id);
  const userId = Number(req.query.userId);
  const limitRaw = req.query.limit;
  const limit = Number.isInteger(Number(limitRaw)) ? Math.max(1, Math.min(500, Number(limitRaw))) : 200;

  if (!conversationId || !userId) {
    return res.status(400).json({ message: 'conversation id and userId are required.' });
  }

  try {
    const membership = await db.query(
      `SELECT 1
       FROM conversation_members
       WHERE conversation_id = $1 AND user_id = $2
       LIMIT 1`,
      [conversationId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this conversation.' });
    }

    const { rows } = await db.query(
      `SELECT m.id, m.content, m.created_at, a.username, a.id AS user_id
       FROM messages m
       JOIN accounts a ON a.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    const messages = rows.map((row) => ({
      id: row.id,
      conversationId,
      user: row.username,
      userId: row.user_id,
      text: row.content,
      timestamp: new Date(row.created_at).getTime(),
      status: 'sent'
    }));

    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Fetch direct messages error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
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
        const incomingConversationId = data && data.conversationId ? Number(data.conversationId) : null;

        if (!text) {
          return;
        }

        try {
          if (userId) {
            let conversationId = incomingConversationId;
            if (!conversationId) {
              conversationId = await getGlobalConversationId();
            } else {
              const membership = await db.query(
                `SELECT 1
                 FROM conversation_members
                 WHERE conversation_id = $1 AND user_id = $2
                 LIMIT 1`,
                [conversationId, userId]
              );
              if (membership.rows.length === 0) {
                return;
              }
            }

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
            if (incomingConversationId) {
              message.conversationId = conversationId;
            }
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

async function startServer() {
  await ensureSocialTables();
  server.listen(8000, () => {
    console.log("Server running at http://localhost:8000");
  });
}

startServer().catch((error) => {
  console.error('Startup error:', error);
  process.exit(1);
});
