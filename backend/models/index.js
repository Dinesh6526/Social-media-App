const sequelize = require('../config/db');
const User = require('./User');
const Post = require('./Post');
const Comment = require('./Comment');
const Like = require('./Like');
const Follow = require('./Follow');

// A user has many posts
User.hasMany(Post, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'user_id' });

// A post has many comments
Post.hasMany(Comment, { foreignKey: 'post_id', onDelete: 'CASCADE' });
Comment.belongsTo(Post, { foreignKey: 'post_id' });

// A user has many comments
User.hasMany(Comment, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'user_id' });

// A post has many likes
Post.hasMany(Like, { foreignKey: 'post_id', onDelete: 'CASCADE' });
Like.belongsTo(Post, { foreignKey: 'post_id' });

// A user has many likes
User.hasMany(Like, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Like.belongsTo(User, { foreignKey: 'user_id' });

// Follows: self-referencing many-to-many via a join model
User.belongsToMany(User, {
  through: Follow,
  as: 'Followers',
  foreignKey: 'following_id',
  otherKey: 'follower_id',
});
User.belongsToMany(User, {
  through: Follow,
  as: 'Following',
  foreignKey: 'follower_id',
  otherKey: 'following_id',
});

module.exports = {
  sequelize,
  User,
  Post,
  Comment,
  Like,
  Follow,
};
