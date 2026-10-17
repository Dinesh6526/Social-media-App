const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const sequelize = require('./config/db');
require('./models'); // registers associations

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const { postCommentsRouter, commentsRouter } = require('./routes/comments');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve the frontend as static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/uploads/*', (req, res) => res.status(404).json({ error: 'Media not found.' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/posts/:postId/comments', postCommentsRouter);
app.use('/api/comments', commentsRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fallback to index.html for any non-API route (simple SPA support)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    await sequelize.sync(); // creates tables if they don't exist
    console.log('Models synced.');
    app.listen(PORT, () => console.log(`Ripple server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

start();
