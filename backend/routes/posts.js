const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { Op } = require('sequelize');
const { Post, User, Like, Comment, Follow } = require('../models');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'uploads');
const allowedMediaTypes = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/gif', ['.gif']],
  ['image/webp', ['.webp']],
  ['video/mp4', ['.mp4']],
  ['video/webm', ['.webm']],
]);

fs.mkdirSync(uploadDirectory, { recursive: true });

const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const extensions = allowedMediaTypes.get(file.mimetype);
    if (!extensions || !extensions.includes(extension)) {
      return callback(new Error('Choose a JPG, PNG, GIF, WebP, MP4, or WebM file.'));
    }
    callback(null, true);
  },
}).single('media');

function receiveMedia(req, res, next) {
  uploadMedia(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Media files must be 50 MB or smaller.' : err.message,
    });
  });
}

// Helper: attach like_count, comment_count, liked_by_me to a list of posts
async function attachMeta(posts, userId) {
  const results = [];
  for (const post of posts) {
    const [likeCount, commentCount, likedByMe] = await Promise.all([
      Like.count({ where: { post_id: post.id } }),
      Comment.count({ where: { post_id: post.id } }),
      userId ? Like.findOne({ where: { post_id: post.id, user_id: userId } }) : null,
    ]);
    results.push({
      id: post.id,
      content: post.content,
      image_url: post.image_url,
      created_at: post.created_at,
      author: post.User
        ? {
            id: post.User.id,
            username: post.User.username,
            display_name: post.User.display_name,
            avatar_url: post.User.avatar_url,
          }
        : null,
      like_count: likeCount,
      comment_count: commentCount,
      liked_by_me: !!likedByMe,
    });
  }
  return results;
}

// GET /api/posts?feed=following - defaults to all posts (global feed), newest first
router.get('/', optionalAuth, async (req, res) => {
  try {
    let where = {};

    if (req.query.feed === 'following' && req.userId) {
      const follows = await Follow.findAll({ where: { follower_id: req.userId } });
      const ids = follows.map((f) => f.following_id);
      ids.push(req.userId); // include your own posts in your following feed
      where.user_id = ids;
    }

    const posts = await Post.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    const postsWithMeta = await attachMeta(posts, req.userId);
    res.json({ posts: postsWithMeta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load feed.' });
  }
});

// GET /api/posts/reels - newest video posts
router.get('/reels', optionalAuth, async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: {
        [Op.or]: [
          { image_url: { [Op.like]: '%.mp4%' } },
          { image_url: { [Op.like]: '%.webm%' } },
        ],
      },
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json({ reels: await attachMeta(posts, req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load reels.' });
  }
});

// POST /api/posts - create a post
router.post('/', requireAuth, receiveMedia, async (req, res) => {
  try {
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
    if (!content && !imageUrl) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Add text or media to your post.' });
    }
    if (content.length > 500) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Posts are limited to 500 characters.' });
    }

    const post = await Post.create({ user_id: req.userId, content, image_url: imageUrl });
    const full = await Post.findByPk(post.id, {
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
    });
    const [withMeta] = await attachMeta([full], req.userId);
    res.status(201).json({ post: withMeta });
  } catch (err) {
    console.error(err);
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: 'Could not create post.' });
  }
});

// GET /api/posts/:id - single post
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
    });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const [withMeta] = await attachMeta([post], req.userId);
    res.json({ post: withMeta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load post.' });
  }
});

// DELETE /api/posts/:id - delete own post
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (post.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }
    const uploadedFilename = typeof post.image_url === 'string' && post.image_url.startsWith('/uploads/')
      ? path.basename(post.image_url)
      : null;
    await post.destroy();
    if (uploadedFilename) {
      await fs.promises.unlink(path.join(uploadDirectory, uploadedFilename)).catch(() => {});
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete post.' });
  }
});

// POST /api/posts/:id/like - like a post
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    await Like.findOrCreate({ where: { post_id: post.id, user_id: req.userId } });
    const count = await Like.count({ where: { post_id: post.id } });
    res.json({ liked: true, like_count: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not like post.' });
  }
});

// DELETE /api/posts/:id/like - unlike a post
router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    await Like.destroy({ where: { post_id: req.params.id, user_id: req.userId } });
    const count = await Like.count({ where: { post_id: req.params.id } });
    res.json({ liked: false, like_count: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not unlike post.' });
  }
});

module.exports = router;
