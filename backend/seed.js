const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const sequelize = require('./config/db');
const { User, Post, Comment, Like, Follow } = require('./models');

const DEMO_PASSWORD = 'password123';

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Connected. Resetting tables...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const usersData = [
      { username: 'aria', email: 'aria@example.com', display_name: 'Aria Chen', bio: 'Designing small things with big opinions.' },
      { username: 'devraj', email: 'devraj@example.com', display_name: 'Devraj Menon', bio: 'Backend tinkerer. Coffee-powered.' },
      { username: 'nova', email: 'nova@example.com', display_name: 'Nova Reyes', bio: 'Photos, playlists, and passing thoughts.' },
      { username: 'kabir', email: 'kabir@example.com', display_name: 'Kabir Singh', bio: 'Runner. Reader. Occasional poet.' },
      { username: 'lena', email: 'lena@example.com', display_name: 'Lena Wu', bio: 'Product person exploring the edges of the internet.' },
    ];

    const users = await User.bulkCreate(
      usersData.map((u) => ({ ...u, password_hash: passwordHash }))
    );
    console.log(`Created ${users.length} users (password for all: "${DEMO_PASSWORD}")`);

    const [aria, devraj, nova, kabir, lena] = users;

    const postsData = [
      { user_id: aria.id, content: 'Redesigned my portfolio site this weekend. Small ripples, big difference.' },
      { user_id: aria.id, content: 'Hot take: whitespace is a feature, not an absence of one.' },
      { user_id: devraj.id, content: 'Finally fixed that race condition that has haunted me for two weeks.' },
      { user_id: devraj.id, content: 'MySQL indexes are underrated. Rediscovered that today the hard way.' },
      { user_id: nova.id, content: 'Golden hour on the terrace. Some days the light does all the work.' },
      { user_id: kabir.id, content: '10km this morning before the city woke up. Best kind of quiet.' },
      { user_id: kabir.id, content: 'Currently rereading an old favorite. Some books get better with age, apparently so do we.' },
      { user_id: lena.id, content: 'Shipped a tiny feature today that took three months to get right. Worth it.' },
      { user_id: nova.id, content: 'Playlist of the week is all analog synths and rain sounds.' },
      { user_id: devraj.id, content: 'Note to self: always seed your dev database before demo day.' },
    ];

    const posts = await Post.bulkCreate(postsData);
    console.log(`Created ${posts.length} posts`);

    const commentsData = [
      { post_id: posts[0].id, user_id: devraj.id, content: 'Looks great, the new layout really breathes.' },
      { post_id: posts[0].id, user_id: nova.id, content: 'The color palette is so calming.' },
      { post_id: posts[2].id, user_id: aria.id, content: 'That feeling when the bug finally gives up.' },
      { post_id: posts[4].id, user_id: kabir.id, content: 'This belongs in a gallery.' },
      { post_id: posts[5].id, user_id: lena.id, content: 'Inspiring, might actually go for a run tomorrow.' },
      { post_id: posts[7].id, user_id: kabir.id, content: 'The best features are always the quiet ones.' },
      { post_id: posts[8].id, user_id: aria.id, content: 'Sending me this playlist immediately.' },
    ];
    const comments = await Comment.bulkCreate(commentsData);
    console.log(`Created ${comments.length} comments`);

    const likesData = [
      { post_id: posts[0].id, user_id: devraj.id },
      { post_id: posts[0].id, user_id: nova.id },
      { post_id: posts[0].id, user_id: kabir.id },
      { post_id: posts[2].id, user_id: aria.id },
      { post_id: posts[2].id, user_id: lena.id },
      { post_id: posts[4].id, user_id: aria.id },
      { post_id: posts[4].id, user_id: devraj.id },
      { post_id: posts[4].id, user_id: kabir.id },
      { post_id: posts[4].id, user_id: lena.id },
      { post_id: posts[5].id, user_id: nova.id },
      { post_id: posts[7].id, user_id: aria.id },
      { post_id: posts[8].id, user_id: kabir.id },
    ];
    await Like.bulkCreate(likesData);
    console.log(`Created ${likesData.length} likes`);

    const followsData = [
      { follower_id: aria.id, following_id: devraj.id },
      { follower_id: aria.id, following_id: nova.id },
      { follower_id: devraj.id, following_id: aria.id },
      { follower_id: devraj.id, following_id: lena.id },
      { follower_id: nova.id, following_id: aria.id },
      { follower_id: nova.id, following_id: kabir.id },
      { follower_id: kabir.id, following_id: nova.id },
      { follower_id: kabir.id, following_id: devraj.id },
      { follower_id: lena.id, following_id: aria.id },
      { follower_id: lena.id, following_id: kabir.id },
      { follower_id: lena.id, following_id: nova.id },
    ];
    await Follow.bulkCreate(followsData);
    console.log(`Created ${followsData.length} follow relationships`);

    console.log('\nSeed complete. Demo login credentials (any of these):');
    usersData.forEach((u) => console.log(`  username: ${u.username}  |  password: ${DEMO_PASSWORD}`));

    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
