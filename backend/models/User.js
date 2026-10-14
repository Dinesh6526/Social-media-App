const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    validate: { len: [3, 30] },
  },
  email: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  display_name: {
    type: DataTypes.STRING(60),
    allowNull: true,
  },
  bio: {
    type: DataTypes.STRING(280),
    allowNull: true,
    defaultValue: '',
  },
  avatar_url: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = User;
