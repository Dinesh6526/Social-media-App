const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Post, Follow, Like, Comment } = require('../models');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

// GET /api/users/search?q= - find people by username or display name
router.get('/search', requireAuth, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2) return res.json({ users: [] });

  try {
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: req.userId },
        [Op.or]: [
          { username: { [Op.like]: `%${query}%` } },
          { display_name: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ['id', 'username', 'display_name', 'avatar_url', 'bio'],
      order: [['username', 'ASC']],
      limit: 20,
    });
    const followed = await Follow.findAll({
      where: {
        follower_id: req.userId,
        following_id: { [Op.in]: users.map((user) => user.id) },
      },
      attributes: ['following_id'],
    });
    const followedIds = new Set(followed.map((relation) => relation.following_id));

    res.json({
      users: users.map((user) => ({ ...publicUser(user), is_following: followedIds.has(user.id) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not search people.' });
  }
});

// GET /api/users/:id - profile with follower/following/post counts
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const [postCount, followerCount, followingCount] = await Promise.all([
      Post.count({ where: { user_id: user.id } }),
      Follow.count({ where: { following_id: user.id } }),
      Follow.count({ where: { follower_id: user.id } }),
    ]);

    let isFollowing = false;
    if (req.userId) {
      const rel = await Follow.findOne({
        where: { follower_id: req.userId, following_id: user.id },
      });
      isFollowing = !!rel;
    }

    res.json({
      user: publicUser(user),
      stats: { posts: postCount, followers: followerCount, following: followingCount },
      is_following: isFollowing,
      is_self: req.userId === user.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

// PUT /api/users/:id - update own profile
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (Number(req.params.id) !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own profile.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const { display_name, bio, avatar_url } = req.body;
    if (display_name !== undefined) user.display_name = display_name;
    if (bio !== undefined) user.bio = bio;
    if (avatar_url !== undefined) user.avatar_url = avatar_url;
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

// PUT /api/users/:id/password - change the authenticated user's password
router.put('/:id/password', requireAuth, async (req, res) => {
  if (Number(req.params.id) !== req.userId) {
    return res.status(403).json({ error: 'You can only change your own password.' });
  }

  const { current_password, new_password } = req.body;
  if (typeof current_password !== 'string' || typeof new_password !== 'string') {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const currentPasswordMatches = await bcrypt.compare(current_password, user.password_hash);
    if (!currentPasswordMatches) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();
    res.json({ password_changed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not change password.' });
  }
});

// GET /api/users/:id/posts - posts by a specific user
router.get('/:id/posts', optionalAuth, async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { user_id: req.params.id },
      include: [{ model: User, attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
    });

    const postsWithMeta = await attachMeta(posts, req.userId);
    res.json({ posts: postsWithMeta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load posts.' });
  }
});

// POST /api/users/:id/follow - follow a user
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.userId) {
      return res.status(400).json({ error: "You can't follow yourself." });
    }
    const target = await User.findByPk(targetId);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const [rel, created] = await Follow.findOrCreate({
      where: { follower_id: req.userId, following_id: targetId },
    });
    res.json({ following: true, already_following: !created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not follow user.' });
  }
});

// DELETE /api/users/:id/follow - unfollow a user
router.delete('/:id/follow', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    await Follow.destroy({ where: { follower_id: req.userId, following_id: targetId } });
    res.json({ following: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not unfollow user.' });
  }
});

// GET /api/users/:id/followers
router.get('/:id/followers', async (req, res) => {
  try {
    const follows = await Follow.findAll({ where: { following_id: req.params.id } });
    const followerIds = follows.map((f) => f.follower_id);
    const followers = await User.findAll({ where: { id: followerIds } });
    res.json({ followers: followers.map(publicUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load followers.' });
  }
});

// GET /api/users/:id/following
router.get('/:id/following', async (req, res) => {
  try {
    const follows = await Follow.findAll({ where: { follower_id: req.params.id } });
    const followingIds = follows.map((f) => f.following_id);
    const following = await User.findAll({ where: { id: followingIds } });
    res.json({ following: following.map(publicUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load following list.' });
  }
});

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

module.exports = router;
