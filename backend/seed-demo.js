require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User, Post, Like, Follow } = require('./models');

const demoPassword = 'ripple-demo-2026';
const demoReelVideoUrls = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://media.w3.org/2010/05/sintel/trailer.mp4',
  'https://media.w3.org/2010/05/bunny/trailer.mp4',
  'https://media.w3.org/2010/05/video/movie_300.mp4',
  'https://samplelib.com/mp4/sample-5s.mp4',
  'https://samplelib.com/vertical/sample-vertical-5s.mp4',
  'https://videos.pexels.com/video-files/3141208/3141208-hd_1920_1080_25fps.mp4',
  'https://videos.pexels.com/video-files/3015510/3015510-hd_1920_1080_24fps.mp4',
  'https://videos.pexels.com/video-files/857042/857042-hd_1920_1080_30fps.mp4',
  'https://videos.pexels.com/video-files/6338336/6338336-sd_640_360_24fps.mp4',
];
const reelProfiles = new Map([[2, 0], [13, 1], [18, 2]]);
const photos = [
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200&q=85',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=85',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=85',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=85',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200&q=85',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&q=85',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&q=85',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=85',
];

const profiles = [
  { username: 'demo_maya', name: 'Maya Shah', bio: 'Collecting quiet mornings and good light.', post: 'Found a little patch of calm before the city woke up.' },
  { username: 'demo_arjun', name: 'Arjun Mehta', bio: 'Weekend hikes, weekday sketches.', post: 'The long way home was the right choice today.' },
  { username: 'demo_nisha', name: 'Nisha Rao', bio: 'Small details make the whole day.', post: 'A few seconds of green for your timeline.' },
  { username: 'demo_rohan', name: 'Rohan Kapoor', bio: 'Somewhere between the trail and the table.', post: 'Still thinking about this view.' },
  { username: 'demo_priya', name: 'Priya Iyer', bio: 'Making room for slower things.', post: 'Sea air, no plans, and nowhere else to be.' },
  { username: 'demo_dev', name: 'Dev Menon', bio: 'Builder by day, camera roll curator by night.', post: 'A reminder to look up from the screen.' },
  { username: 'demo_sara', name: 'Sara Khan', bio: 'Light changes everything.', post: 'The sky did all the work on this one.' },
  { username: 'demo_kabir', name: 'Kabir Verma', bio: 'One more turn around the trail.', post: 'Saved this corner for a day that needed it.' },
  { username: 'demo_anaya', name: 'Anaya Joshi', bio: 'Plants, places, and playlists.', post: 'A softer pace looks good on the weekend.' },
  { username: 'demo_ishita', name: 'Ishita Das', bio: 'Learning to notice the in-between.', post: 'A little color from the afternoon walk.' },
  { username: 'demo_veer', name: 'Veer Singh', bio: 'Outside whenever possible.', post: 'Fresh air was the whole plan.' },
  { username: 'demo_tara', name: 'Tara Nair', bio: 'Postcards from ordinary days.', post: 'The light stayed for just a minute.' },
  { username: 'demo_rehan', name: 'Rehan Ali', bio: 'Finding new paths close to home.', post: 'Took the path without a sign. Worth it.' },
  { username: 'demo_zoya', name: 'Zoya Malik', bio: 'A little motion, a little stillness.', post: 'Letting the day move at its own speed.' },
  { username: 'demo_neel', name: 'Neel Patel', bio: 'Good walks, better conversations.', post: 'Proof that the small detour is sometimes the best part.' },
  { username: 'demo_mira', name: 'Mira Sen', bio: 'Keeping the good bits close.', post: 'Blue hour made everything feel new.' },
  { username: 'demo_omar', name: 'Omar Hussain', bio: 'Outside is my favorite room.', post: 'A quick look at the view before heading back.' },
  { username: 'demo_aanya', name: 'Aanya Gupta', bio: 'Making memories without a big plan.', post: 'Found a view worth sharing.' },
  { username: 'demo_vivaan', name: 'Vivaan Bose', bio: 'A camera and a free afternoon.', post: 'More of this, less rushing.' },
  { username: 'demo_leela', name: 'Leela Krishnan', bio: 'Noticing the little things.', post: 'Ending the day with a bit of open sky.' },
];

const reelCaptions = [
  'A tiny pause before the day gets busy.',
  'A little green on your screen today.',
  'Somewhere quiet, for a few seconds.',
  'The kind of afternoon you want to keep.',
  'Slow down and watch the light move.',
  'A small reset between everything else.',
  'Sending a little calm your way.',
];

async function seedDemo() {
  let transaction;
  try {
    await sequelize.authenticate();
    transaction = await sequelize.transaction();
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const demoUsers = [];

    for (const [index, profile] of profiles.entries()) {
      const [user] = await User.findOrCreate({
        where: { username: profile.username },
        defaults: {
          username: profile.username,
          email: `${profile.username}@ripple.demo`,
          password_hash: passwordHash,
          display_name: profile.name,
          bio: profile.bio,
          avatar_url: `https://i.pravatar.cc/160?img=${index + 10}`,
        },
        transaction,
      });
      demoUsers.push(user);
    }

    for (const [index, profile] of profiles.entries()) {
      const user = demoUsers[index];
      const reelSourceIndex = reelProfiles.get(index);
      const mediaUrl = reelSourceIndex !== undefined
        ? demoReelVideoUrls[reelSourceIndex]
        : [0, 1, 3, 4, 6, 7, 9, 11, 15, 17].includes(index)
          ? photos[index % photos.length]
          : null;
      const [post] = await Post.findOrCreate({
        where: { user_id: user.id, content: profile.post },
        defaults: { user_id: user.id, content: profile.post, image_url: mediaUrl },
        transaction,
      });
      if (mediaUrl && post.image_url !== mediaUrl) {
        post.image_url = mediaUrl;
        await post.save({ transaction });
      }

      const liker = demoUsers[(index + 1) % demoUsers.length];
      await Like.findOrCreate({
        where: { post_id: post.id, user_id: liker.id },
        defaults: { post_id: post.id, user_id: liker.id },
        transaction,
      });
    }

    for (const [index, caption] of reelCaptions.entries()) {
      const user = demoUsers[index];
      const content = `Reel: ${caption}`;
      const [post] = await Post.findOrCreate({
        where: { user_id: user.id, content },
        defaults: {
          user_id: user.id,
          content,
          image_url: demoReelVideoUrls[(index + 3) % demoReelVideoUrls.length],
        },
        transaction,
      });
      const videoUrl = demoReelVideoUrls[(index + 3) % demoReelVideoUrls.length];
      if (post.image_url !== videoUrl) {
        post.image_url = videoUrl;
        await post.save({ transaction });
      }
      const liker = demoUsers[(index + 2) % demoUsers.length];
      await Like.findOrCreate({
        where: { post_id: post.id, user_id: liker.id },
        defaults: { post_id: post.id, user_id: liker.id },
        transaction,
      });
    }

    for (let index = 0; index < demoUsers.length; index += 1) {
      for (const offset of [1, 2, 3]) {
        const followedUser = demoUsers[(index + offset) % demoUsers.length];
        await Follow.findOrCreate({
          where: { follower_id: demoUsers[index].id, following_id: followedUser.id },
          defaults: { follower_id: demoUsers[index].id, following_id: followedUser.id },
          transaction,
        });
      }
    }

    const ownerUsername = process.env.DEMO_OWNER_USERNAME;
    const owner = ownerUsername
      ? await User.findOne({ where: { username: ownerUsername }, transaction })
      : await User.findOne({
          where: { email: { [Op.notLike]: '%@ripple.demo' } },
          order: [['created_at', 'ASC']],
          transaction,
        });

    if (owner) {
      for (const demoUser of demoUsers) {
        if (demoUser.id === owner.id) continue;
        await Follow.findOrCreate({
          where: { follower_id: owner.id, following_id: demoUser.id },
          defaults: { follower_id: owner.id, following_id: demoUser.id },
          transaction,
        });
      }
    }

    await transaction.commit();
    console.log(`Added ${demoUsers.length} demo profiles and posts without resetting existing data.`);
    console.log(owner
      ? `Added all demo profiles to @${owner.username}'s following list.`
      : 'No regular user was found to follow the demo profiles.');
    console.log(`Demo profile password: ${demoPassword}`);
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('Demo data setup failed:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seedDemo();