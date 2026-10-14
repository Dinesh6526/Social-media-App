const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  follower_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  following_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'follows',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['follower_id', 'following_id'] },
  ],
});

module.exports = Follow;
