const express = require('express');
const { Comment, User, Post } = require('../models');
const { requireAuth } = require('../middleware/auth');

// Mounted at /api/posts/:postId/comments
const postCommentsRouter = express.Router({ mergeParams: true });
// Mounted at /api/comments/:id
const commentsRouter = express.Router();

function shapeComment(comment) {
  return {
    id: comment.id,
    post_id: comment.post_id,
    content: comment.content,
    created_at: comment.created_at,
    author: comment.User
      ? {
          id: comment.User.id,
          username: comment.User.username,
          display_name: comment.User.display_name,
          avatar_url: comment.User.avatar_url,
        }
      : null,
  };
}

// GET /api/posts/:postId/comments - list comments for a post
postCommentsRouter.get('/', async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { post_id: req.params.postId },
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
      order: [['created_at', 'ASC']],
    });
    res.json({ comments: comments.map(shapeComment) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load comments.' });
  }
});

// POST /api/posts/:postId/comments - add a comment
postCommentsRouter.post('/', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty.' });
    }
    if (content.length > 300) {
      return res.status(400).json({ error: 'Comments are limited to 300 characters.' });
    }

    const post = await Post.findByPk(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = await Comment.create({
      post_id: req.params.postId,
      user_id: req.userId,
      content,
    });
    const full = await Comment.findByPk(comment.id, {
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
    });
    res.status(201).json({ comment: shapeComment(full) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add comment.' });
  }
});

// DELETE /api/comments/:id - delete own comment
commentsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    if (comment.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own comments.' });
    }
    await comment.destroy();
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete comment.' });
  }
});

module.exports = { postCommentsRouter, commentsRouter };
