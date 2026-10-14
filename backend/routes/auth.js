const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.display_name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({
      where: { [require('sequelize').Op.or]: [{ username }, { email }] },
    });
    if (existing) {
      return res.status(409).json({ error: 'Username or email is already taken.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password_hash,
      display_name: display_name || username,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = username or email

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [{ username: identifier }, { email: identifier }],
      },
    });
    if (!user) {
      return res.status(401).json({ error: 'Incorrect username/email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect username/email or password.' });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not log in. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
