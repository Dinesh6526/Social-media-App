/* ============================================================
   Ripple — app logic
   Small hand-rolled SPA: view switching + fetch calls, no
   framework, no build step.
   ============================================================ */

const state = {
  user: null,        // currently logged-in user
  feedMode: 'all',    // 'all' | 'following'
  profileUserId: null,
  profileTab: 'posts',
  currentPostId: null,
};

const el = (sel, root = document) => root.querySelector(sel);
const els = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

function avatarHtml(user, size = '') {
  const cls = `avatar ${size}`.trim();
  if (user && user.avatar_url) {
    return `<div class="${cls}"><img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.display_name || user.username)}" /></div>`;
  }
  return `<div class="${cls}">${initials(user ? (user.display_name || user.username) : '?')}</div>`;
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w`;
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let toastTimer = null;
function toast(message) {
  const t = el('#toast');
  t.textContent = message;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ------------------------------------------------------------
   Auth
   ------------------------------------------------------------ */
function initAuthTabs() {
  els('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      els('.auth-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      el('#form-login').classList.toggle('hidden', target !== 'login');
      el('#form-register').classList.toggle('hidden', target !== 'register');
      el('#login-error').textContent = '';
      el('#register-error').textContent = '';
    });
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const identifier = form.identifier.value.trim();
  const password = form.password.value;
  el('#login-error').textContent = '';
  try {
    const data = await Api.login({ identifier, password });
    Api.setToken(data.token);
    state.user = data.user;
    await enterApp();
  } catch (err) {
    el('#login-error').textContent = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    display_name: form.display_name.value.trim(),
    username: form.username.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
  };
  el('#register-error').textContent = '';
  try {
    const data = await Api.register(payload);
    Api.setToken(data.token);
    state.user = data.user;
    await enterApp();
  } catch (err) {
    el('#register-error').textContent = err.message;
  }
}

function logout() {
  Api.setToken(null);
  state.user = null;
  el('#view-app').classList.add('hidden');
  el('#view-auth').classList.remove('hidden');
  el('#form-login').reset();
  el('#form-register').reset();
}

async function enterApp() {
  el('#view-auth').classList.add('hidden');
  el('#view-app').classList.remove('hidden');
  renderMiniProfile();
  await navigate('feed', { feed: 'all' });
}

/* ------------------------------------------------------------
   Sidebar / mini profile
   ------------------------------------------------------------ */
function renderMiniProfile() {
  if (!state.user) return;
  el('#mini-profile').innerHTML = `
    ${avatarHtml(state.user, 'avatar-sm')}
    <div>
      <div class="mini-name">${escapeHtml(state.user.display_name || state.user.username)}</div>
      <div class="mini-handle">@${escapeHtml(state.user.username)}</div>
    </div>
  `;
}

function initNav() {
  els('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      els('.nav-link').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const route = btn.dataset.route;
      if (route === 'feed') {
        navigate('feed', { feed: btn.dataset.feed });
      } else if (route === 'reels') {
        navigate('reels');
      } else if (route === 'search') {
        navigate('search');
      } else if (route === 'profile') {
        navigate('profile', { userId: state.user.id });
      }
    });
  });
  el('#btn-logout').addEventListener('click', logout);
}

/* ------------------------------------------------------------
   Router — swap which <section class="view"> is visible
   ------------------------------------------------------------ */
function showView(name) {
  ['feed', 'reels', 'search', 'profile', 'post'].forEach((v) => {
    el(`#view-${v}`).classList.toggle('hidden', v !== name);
  });
}

async function navigate(route, params = {}) {
  if (route === 'feed') {
    state.feedMode = params.feed || 'all';
    showView('feed');
    el('#feed-title').textContent = state.feedMode === 'following' ? 'Following' : 'Home';
    await loadFeed();
  } else if (route === 'reels') {
    showView('reels');
    await loadReels();
  } else if (route === 'search') {
    showView('search');
    el('#people-search-input').focus();
  } else if (route === 'profile') {
    state.profileUserId = params.userId;
    state.profileTab = 'posts';
    showView('profile');
    await loadProfile();
  } else if (route === 'post') {
    state.currentPostId = params.postId;
    showView('post');
    await loadPostDetail();
  }
}

/* ------------------------------------------------------------
   Feed
   ------------------------------------------------------------ */
async function loadFeed() {
  const list = el('#feed-list');
  list.innerHTML = '';
  try {
    const data = await Api.getFeed(state.feedMode);
    el('#feed-empty').classList.toggle('hidden', data.posts.length > 0);
    data.posts.forEach((post) => list.appendChild(renderPostCard(post)));
  } catch (err) {
    toast(err.message);
  }
}

async function loadReels() {
  const list = el('#reels-list');
  list.replaceChildren();
  try {
    const data = await Api.getReels();
    el('#reels-empty').classList.toggle('hidden', data.reels.length > 0);
    data.reels.forEach((reel) => list.appendChild(renderReelCard(reel)));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        const video = el('video', target);
        if (isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    }, { threshold: 0.6 });
    list.querySelectorAll('.reel-card').forEach((card) => observer.observe(card));
  } catch (err) {
    toast(err.message);
  }
}

function renderReelCard(reel) {
  const card = document.createElement('article');
  card.className = 'reel-card';
  card.dataset.postId = reel.id;
  const isOwn = state.user && reel.author && reel.author.id === state.user.id;
  card.innerHTML = `
    <video class="reel-video" src="${escapeHtml(reel.image_url)}" muted loop playsinline controls preload="metadata"></video>
    <div class="reel-shade" aria-hidden="true"></div>
    <div class="reel-caption">
      <button type="button" class="reel-author">
        ${avatarHtml(reel.author, 'avatar-sm')}
        <span>@${escapeHtml(reel.author ? reel.author.username : '')}</span>
      </button>
      ${reel.content ? `<p>${escapeHtml(reel.content)}</p>` : ''}
    </div>
    <div class="reel-actions">
      <button class="reel-action like-btn ${reel.liked_by_me ? 'is-liked' : ''}" aria-label="${reel.liked_by_me ? 'Unlike reel' : 'Like reel'}" aria-pressed="${reel.liked_by_me}">
        <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.3 4.5 6 4.5c2 0 3.4 1 6 3.4 2.6-2.4 4-3.4 6-3.4 3.7 0 5.5 3.5 4 7.2C19.5 16.4 12 21 12 21z"/></svg>
        <span class="like-count">${reel.like_count}</span>
      </button>
      <button class="reel-action comment-btn" aria-label="Open comments">
        <svg viewBox="0 0 24 24"><path d="M4 4h16v12H8l-4 4V4z"/></svg>
        <span>${reel.comment_count}</span>
      </button>
      ${isOwn ? '<button class="reel-action reel-delete delete-btn" aria-label="Delete reel"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>' : ''}
    </div>
  `;

  el('.like-btn', card).addEventListener('click', (event) => toggleLike(event, reel.id));
  el('.comment-btn', card).addEventListener('click', () => navigate('post', { postId: reel.id }));
  el('.reel-author', card).addEventListener('click', () => {
    if (reel.author) navigate('profile', { userId: reel.author.id });
  });
  const deleteButton = el('.delete-btn', card);
  if (deleteButton) deleteButton.addEventListener('click', (event) => handleDeletePost(event, reel.id));
  return card;
}

function renderPostCard(post) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.postId = post.id;

  const isOwn = state.user && post.author && post.author.id === state.user.id;
  const mediaIsVideo = post.image_url && /\.(mp4|webm)(?:[?#].*)?$/i.test(post.image_url);
  const mediaMarkup = !post.image_url ? '' : mediaIsVideo
    ? `<video class="post-media" src="${escapeHtml(post.image_url)}" controls playsinline preload="metadata"></video>`
    : `<img class="post-media" src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.content || 'Post photo')}" loading="lazy" />`;

  card.innerHTML = `
    ${avatarHtml(post.author)}
    <div class="post-body">
      <div class="post-meta">
        <span class="post-author-name">${escapeHtml(post.author ? (post.author.display_name || post.author.username) : 'Unknown')}</span>
        <span class="post-author-handle">@${escapeHtml(post.author ? post.author.username : '')}</span>
        <span class="post-time">${timeAgo(post.created_at)}</span>
      </div>
      ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ''}
      ${mediaMarkup}
      <div class="post-actions">
        <button class="action-btn like-btn ${post.liked_by_me ? 'is-liked' : ''}" data-post-id="${post.id}" aria-label="${post.liked_by_me ? 'Unlike post' : 'Like post'}" aria-pressed="${post.liked_by_me}">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.3 4.5 6 4.5c2 0 3.4 1 6 3.4 2.6-2.4 4-3.4 6-3.4 3.7 0 5.5 3.5 4 7.2C19.5 16.4 12 21 12 21z"/></svg>
          <span class="like-count">${post.like_count}</span>
        </button>
        <button class="action-btn comment-btn" data-post-id="${post.id}">
          <svg viewBox="0 0 24 24"><path d="M4 4h16v12H8l-4 4V4z"/></svg>
          <span>${post.comment_count}</span>
        </button>
        ${isOwn ? `<button class="action-btn delete-btn" data-post-id="${post.id}">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>` : ''}
      </div>
    </div>
  `;

  // Clicking the card (but not its buttons) opens the post detail
  card.addEventListener('click', (e) => {
    if (e.target.closest('button, video')) return;
    navigate('post', { postId: post.id });
  });

  el('.like-btn', card).addEventListener('click', (e) => toggleLike(e, post.id));
  el('.comment-btn', card).addEventListener('click', () => navigate('post', { postId: post.id }));
  const delBtn = el('.delete-btn', card);
  if (delBtn) delBtn.addEventListener('click', (e) => handleDeletePost(e, post.id));

  // author avatar/name -> profile
  el('.post-meta', card).addEventListener('click', (e) => {
    e.stopPropagation();
    if (post.author) navigate('profile', { userId: post.author.id });
  });

  return card;
}

async function toggleLike(e, postId) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const wasLiked = btn.classList.contains('is-liked');
  try {
    const data = wasLiked ? await Api.unlikePost(postId) : await Api.likePost(postId);
    btn.classList.toggle('is-liked', data.liked);
    btn.setAttribute('aria-pressed', String(data.liked));
    btn.setAttribute('aria-label', data.liked ? 'Unlike post' : 'Like post');
    el('.like-count', btn).textContent = data.like_count;
    if (data.liked) spawnRipple(btn);
  } catch (err) {
    toast(err.message);
  }
}

function spawnRipple(btn) {
  const burst = document.createElement('span');
  burst.className = 'ripple-burst';
  btn.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove());
}

async function handleDeletePost(e, postId) {
  e.stopPropagation();
  if (!confirm('Delete this post? This can\'t be undone.')) return;
  try {
    await Api.deletePost(postId);
    toast('Post deleted.');
    if (state.currentPostId === postId) {
      navigate('feed', { feed: state.feedMode });
    } else if (!el('#view-reels').classList.contains('hidden')) {
      await loadReels();
    } else {
      await loadFeed();
      if (!el('#view-profile').classList.contains('hidden')) await loadProfile();
    }
  } catch (err) {
    toast(err.message);
  }
}

function initComposer() {
  const textarea = el('#form-new-post textarea');
  const mediaInput = el('#post-media-input');
  const mediaPreview = el('#media-preview');
  const submitButton = el('#form-new-post button[type="submit"]');
  let previewUrl = null;

  const clearMediaPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    mediaPreview.replaceChildren();
    mediaPreview.classList.add('hidden');
  };

  textarea.addEventListener('input', () => {
    el('#char-count-val').textContent = textarea.value.length;
  });

  mediaInput.addEventListener('change', () => {
    clearMediaPreview();
    const file = mediaInput.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      mediaInput.value = '';
      toast('Media files must be 50 MB or smaller.');
      return;
    }

    previewUrl = URL.createObjectURL(file);
    const preview = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
    preview.className = 'media-preview-content';
    preview.src = previewUrl;
    if (preview instanceof HTMLVideoElement) {
      preview.controls = true;
      preview.muted = true;
      preview.playsInline = true;
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'media-remove';
    removeButton.setAttribute('aria-label', 'Remove selected media');
    removeButton.title = 'Remove media';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      mediaInput.value = '';
      clearMediaPreview();
    });

    mediaPreview.replaceChildren(preview, removeButton);
    mediaPreview.classList.remove('hidden');
  });

  el('#form-new-post').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = textarea.value.trim();
    const media = mediaInput.files[0];
    if (!content && !media) return;
    const payload = new FormData();
    payload.append('content', content);
    if (media) payload.append('media', media);
    submitButton.disabled = true;
    try {
      await Api.createPost(payload);
      textarea.value = '';
      mediaInput.value = '';
      clearMediaPreview();
      el('#char-count-val').textContent = '0';
      toast('Posted.');
      await loadFeed();
    } catch (err) {
      toast(err.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

/* ------------------------------------------------------------
   Profile
   ------------------------------------------------------------ */
async function loadProfile() {
  const id = state.profileUserId;
  try {
    const data = await Api.getUser(id);
    renderProfileHeader(data);
    setProfileTab(state.profileTab);
  } catch (err) {
    toast(err.message);
  }
}

function renderProfileHeader(data) {
  const { user, stats, is_following, is_self } = data;
  el('#profile-header').innerHTML = `
    <div class="profile-header-top">
      <div class="profile-identity">
        ${avatarHtml(user, 'avatar-lg')}
        <div>
          <h2 class="profile-name">${escapeHtml(user.display_name || user.username)}</h2>
          <div class="profile-handle">@${escapeHtml(user.username)}</div>
        </div>
      </div>
      <div>
        ${is_self
          ? `<button class="btn btn-ghost btn-small" id="btn-edit-profile">Edit profile</button>`
          : `<button class="btn btn-follow btn-small ${is_following ? 'is-following' : ''}" id="btn-follow-toggle">${is_following ? 'Following' : 'Follow'}</button>`
        }
      </div>
    </div>
    ${user.bio ? `<p class="profile-bio">${escapeHtml(user.bio)}</p>` : ''}
    <div class="profile-stats">
      <span class="profile-stat"><strong>${stats.posts}</strong> posts</span>
      <span class="profile-stat"><strong>${stats.followers}</strong> followers</span>
      <span class="profile-stat"><strong>${stats.following}</strong> following</span>
    </div>
  `;

  if (is_self) {
    el('#btn-edit-profile').addEventListener('click', () => openEditProfile(user));
  } else {
    el('#btn-follow-toggle').addEventListener('click', (e) => toggleFollow(e, user.id));
  }
}

async function toggleFollow(e, userId) {
  const btn = e.currentTarget;
  const wasFollowing = btn.classList.contains('is-following');
  try {
    const data = wasFollowing ? await Api.unfollow(userId) : await Api.follow(userId);
    btn.classList.toggle('is-following', data.following);
    btn.textContent = data.following ? 'Following' : 'Follow';
    await loadProfile(); // refresh counts
  } catch (err) {
    toast(err.message);
  }
}

function initProfileTabs() {
  els('.profile-tab').forEach((tab) => {
    tab.addEventListener('click', () => setProfileTab(tab.dataset.ptab));
  });
}

async function setProfileTab(tab) {
  state.profileTab = tab;
  els('.profile-tab').forEach((t) => t.classList.toggle('active', t.dataset.ptab === tab));
  el('#profile-posts').classList.toggle('hidden', tab !== 'posts');
  el('#profile-followers').classList.toggle('hidden', tab !== 'followers');
  el('#profile-following').classList.toggle('hidden', tab !== 'following');

  if (tab === 'posts') await loadProfilePosts();
  else if (tab === 'followers') await loadFollowList('followers');
  else if (tab === 'following') await loadFollowList('following');
}

async function loadProfilePosts() {
  const list = el('#profile-posts');
  list.innerHTML = '';
  try {
    const data = await Api.getUserPosts(state.profileUserId);
    if (data.posts.length === 0) {
      list.innerHTML = '<p class="empty-state">No posts yet.</p>';
      return;
    }
    data.posts.forEach((post) => list.appendChild(renderPostCard(post)));
  } catch (err) {
    toast(err.message);
  }
}

async function loadFollowList(kind) {
  const container = el(`#profile-${kind}`);
  container.innerHTML = '';
  try {
    const data = kind === 'followers' ? await Api.getFollowers(state.profileUserId) : await Api.getFollowing(state.profileUserId);
    const people = kind === 'followers' ? data.followers : data.following;
    if (people.length === 0) {
      container.innerHTML = `<p class="empty-state">No ${kind} yet.</p>`;
      return;
    }
    people.forEach((person) => {
      const row = document.createElement('div');
      row.className = 'people-row';
      row.innerHTML = `
        ${avatarHtml(person, 'avatar-sm')}
        <div class="people-info">
          <div class="people-name">${escapeHtml(person.display_name || person.username)}</div>
          <div class="people-handle">@${escapeHtml(person.username)}</div>
        </div>
      `;
      row.addEventListener('click', () => navigate('profile', { userId: person.id }));
      container.appendChild(row);
    });
  } catch (err) {
    toast(err.message);
  }
}

function initPeopleSearch() {
  const form = el('#people-search-form');
  const input = el('#people-search-input');
  const status = el('#people-search-status');
  const results = el('#people-search-results');
  let debounceTimer = null;
  let latestSearch = 0;

  const search = async () => {
    const query = input.value.trim();
    const searchId = ++latestSearch;
    results.replaceChildren();

    if (query.length < 2) {
      status.textContent = 'Enter at least 2 characters to search.';
      status.classList.remove('hidden');
      return;
    }

    status.textContent = 'Searching...';
    status.classList.remove('hidden');
    try {
      const data = await Api.searchUsers(query);
      if (searchId !== latestSearch) return;
      if (data.users.length === 0) {
        status.textContent = 'No people found.';
        return;
      }
      status.classList.add('hidden');
      data.users.forEach((person) => results.appendChild(renderSearchResult(person)));
    } catch (err) {
      if (searchId !== latestSearch) return;
      status.textContent = err.message;
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(search, 250);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(debounceTimer);
    search();
  });
}

function renderSearchResult(person) {
  const row = document.createElement('div');
  row.className = 'people-row search-result';

  const profileButton = document.createElement('button');
  profileButton.type = 'button';
  profileButton.className = 'search-profile-button';
  profileButton.innerHTML = `
    ${avatarHtml(person, 'avatar-sm')}
    <span class="people-info">
      <span class="people-name">${escapeHtml(person.display_name || person.username)}</span>
      <span class="people-handle">@${escapeHtml(person.username)}</span>
    </span>
  `;
  profileButton.addEventListener('click', () => navigate('profile', { userId: person.id }));

  const followButton = document.createElement('button');
  followButton.type = 'button';
  followButton.className = `btn btn-follow btn-small${person.is_following ? ' is-following' : ''}`;
  followButton.textContent = person.is_following ? 'Following' : 'Follow';
  followButton.setAttribute('aria-pressed', String(person.is_following));
  followButton.addEventListener('click', async () => {
    followButton.disabled = true;
    try {
      const data = person.is_following
        ? await Api.unfollow(person.id)
        : await Api.follow(person.id);
      person.is_following = data.following;
      followButton.classList.toggle('is-following', data.following);
      followButton.textContent = data.following ? 'Following' : 'Follow';
      followButton.setAttribute('aria-pressed', String(data.following));
    } catch (err) {
      toast(err.message);
    } finally {
      followButton.disabled = false;
    }
  });

  row.append(profileButton, followButton);
  return row;
}

/* ------------------------------------------------------------
   Edit profile modal
   ------------------------------------------------------------ */
function openEditProfile(user) {
  const form = el('#form-edit-profile');
  form.display_name.value = user.display_name || '';
  form.bio.value = user.bio || '';
  form.avatar_url.value = user.avatar_url || '';
  el('#modal-edit-profile').classList.remove('hidden');
}

function initEditProfileModal() {
  el('#btn-cancel-edit').addEventListener('click', () => {
    el('#modal-edit-profile').classList.add('hidden');
  });
  el('#form-edit-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const data = await Api.updateUser(state.user.id, {
        display_name: form.display_name.value.trim(),
        bio: form.bio.value.trim(),
        avatar_url: form.avatar_url.value.trim(),
      });
      state.user = { ...state.user, ...data.user };
      renderMiniProfile();
      el('#modal-edit-profile').classList.add('hidden');
      toast('Profile updated.');
      await loadProfile();
    } catch (err) {
      toast(err.message);
    }
  });
}

/* ------------------------------------------------------------
   Post detail + comments
   ------------------------------------------------------------ */
async function loadPostDetail() {
  const card = el('#post-detail-card');
  const commentList = el('#comment-list');
  card.innerHTML = '';
  commentList.innerHTML = '';
  try {
    const { post } = await Api.getPost(state.currentPostId);
    card.appendChild(renderPostCard(post));
    await loadComments();
  } catch (err) {
    toast(err.message);
  }
}

async function loadComments() {
  const list = el('#comment-list');
  list.innerHTML = '';
  try {
    const data = await Api.getComments(state.currentPostId);
    if (data.comments.length === 0) {
      list.innerHTML = '<p class="empty-state">No replies yet. Start the ripple.</p>';
      return;
    }
    data.comments.forEach((c) => list.appendChild(renderCommentRow(c)));
  } catch (err) {
    toast(err.message);
  }
}

function renderCommentRow(comment) {
  const row = document.createElement('div');
  row.className = 'comment-row';
  const isOwn = state.user && comment.author && comment.author.id === state.user.id;
  row.innerHTML = `
    ${avatarHtml(comment.author, 'avatar-sm')}
    <div class="comment-body">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(comment.author ? (comment.author.display_name || comment.author.username) : 'Unknown')}</span>
        <span class="post-time">${timeAgo(comment.created_at)}</span>
        ${isOwn ? `<button class="action-btn delete-btn" style="margin-left:auto" data-comment-id="${comment.id}">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>` : ''}
      </div>
      <div class="comment-content">${escapeHtml(comment.content)}</div>
    </div>
  `;
  const delBtn = el('.delete-btn', row);
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      try {
        await Api.deleteComment(comment.id);
        await loadComments();
        await loadPostDetail();
      } catch (err) {
        toast(err.message);
      }
    });
  }
  return row;
}

function initCommentComposer() {
  const textarea = el('#form-new-comment textarea');
  textarea.addEventListener('input', () => {
    el('#comment-char-count-val').textContent = textarea.value.length;
  });
  el('#form-new-comment').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = textarea.value.trim();
    if (!content) return;
    try {
      await Api.addComment(state.currentPostId, { content });
      textarea.value = '';
      el('#comment-char-count-val').textContent = '0';
      await loadComments();
      const { post } = await Api.getPost(state.currentPostId);
      el('#post-detail-card').innerHTML = '';
      el('#post-detail-card').appendChild(renderPostCard(post));
    } catch (err) {
      toast(err.message);
    }
  });
}

function initBackButton() {
  el('#btn-back-to-feed').addEventListener('click', () => {
    els('.nav-link').forEach((b) => b.classList.remove('active'));
    el('[data-route="feed"][data-feed="all"]').classList.add('active');
    navigate('feed', { feed: state.feedMode });
  });
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
async function boot() {
  initAuthTabs();
  el('#form-login').addEventListener('submit', handleLogin);
  el('#form-register').addEventListener('submit', handleRegister);
  initNav();
  initPeopleSearch();
  initComposer();
  initProfileTabs();
  initEditProfileModal();
  initCommentComposer();
  initBackButton();

  const token = Api.getToken();
  if (token) {
    try {
      const data = await Api.me();
      state.user = data.user;
      await enterApp();
      return;
    } catch (err) {
      Api.setToken(null);
    }
  }
  el('#view-auth').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', boot);
