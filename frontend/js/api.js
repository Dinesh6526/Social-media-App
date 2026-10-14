/* ============================================================
   Ripple — API layer
   Thin wrapper around fetch(). Stores the JWT in localStorage
   and attaches it to every request automatically.
   ============================================================ */

const API_BASE = window.location.protocol === 'file:'
  ? 'http://localhost:5000/api'
  : '/api';

const Api = {
  getToken() {
    return localStorage.getItem('ripple_token');
  },
  setToken(token) {
    if (token) localStorage.setItem('ripple_token', token);
    else localStorage.removeItem('ripple_token');
  },

  async request(method, path, body) {
    const isFormData = body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Cannot reach the Ripple server. Start the backend and open http://localhost:5000.');
      }
      throw error;
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const message = (data && data.error) || 'Something went wrong. Please try again.';
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body || {}); },
  put(path, body) { return this.request('PUT', path, body || {}); },
  del(path) { return this.request('DELETE', path); },

  // Auth
  register(payload) { return this.post('/auth/register', payload); },
  login(payload) { return this.post('/auth/login', payload); },
  me() { return this.get('/auth/me'); },

  // Users
  getUser(id) { return this.get(`/users/${id}`); },
  searchUsers(query) { return this.get(`/users/search?q=${encodeURIComponent(query)}`); },
  changePassword(id, payload) { return this.put(`/users/${id}/password`, payload); },
  updateUser(id, payload) { return this.put(`/users/${id}`, payload); },
  getUserPosts(id) { return this.get(`/users/${id}/posts`); },
  follow(id) { return this.post(`/users/${id}/follow`); },
  unfollow(id) { return this.del(`/users/${id}/follow`); },
  getFollowers(id) { return this.get(`/users/${id}/followers`); },
  getFollowing(id) { return this.get(`/users/${id}/following`); },

  // Posts
  getFeed(mode) { return this.get(`/posts${mode === 'following' ? '?feed=following' : ''}`); },
  getReels() { return this.get('/posts/reels'); },
  createPost(payload) { return this.post('/posts', payload); },
  getPost(id) { return this.get(`/posts/${id}`); },
  deletePost(id) { return this.del(`/posts/${id}`); },
  likePost(id) { return this.post(`/posts/${id}/like`); },
  unlikePost(id) { return this.del(`/posts/${id}/like`); },

  // Comments
  getComments(postId) { return this.get(`/posts/${postId}/comments`); },
  addComment(postId, payload) { return this.post(`/posts/${postId}/comments`, payload); },
  deleteComment(id) { return this.del(`/comments/${id}`); },
};
