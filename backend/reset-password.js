require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User } = require('./models');

function promptHidden(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal.'));
      return;
    }

    const bytes = [];
    output.write(label);
    input.setRawMode(true);
    input.resume();

    const finish = (error, value) => {
      input.setRawMode(false);
      input.removeListener('data', onData);
      input.pause();
      output.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) return finish(new Error('Password reset canceled.'));
        if (byte === 10 || byte === 13) {
          return finish(null, Buffer.from(bytes).toString('utf8'));
        }
        if (byte === 8 || byte === 127) bytes.pop();
        else if (byte >= 32) bytes.push(byte);
      }
    };

    input.on('data', onData);
  });
}

async function resetPassword() {
  const identity = process.argv[2];
  if (!identity) throw new Error('Usage: npm run reset-password -- <email-or-username>');

  await sequelize.authenticate();
  const user = await User.findOne({
    where: { [Op.or]: [{ email: identity }, { username: identity }] },
  });
  if (!user) throw new Error('No account found for that email or username.');

  const password = await promptHidden('New password (minimum 8 characters): ');
  const confirmation = await promptHidden('Confirm new password: ');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  user.password_hash = await bcrypt.hash(password, 10);
  await user.save();
  console.log('Password reset successfully. The password is stored as a bcrypt hash.');
}

resetPassword()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());