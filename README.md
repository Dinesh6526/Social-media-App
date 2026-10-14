# Ripple — a mini social media app

A small full-stack social app: user profiles, posts, comments, likes, and a
follow system. Node.js/Express + MySQL on the backend, vanilla HTML/CSS/JS
on the frontend (no framework, no build step).

## Features

- **Auth** — register/login with JWT + bcrypt password hashing
- **Profiles** — display name, bio, avatar URL, editable by the owner
- **Posts** — create, delete, view a global feed or a "following" feed
- **Media posts** — upload photos or videos with captions (up to 50 MB)
- **Comments** — threaded under each post
- **Likes** — like/unlike posts, with a live count
- **Follow system** — follow/unfollow users, follower/following lists
- Seed script with 5 demo users, posts, comments, likes, and follows
- Non-destructive demo-data command with 20 profiles and image/video posts

## Tech stack

- Backend: Node.js, Express, Sequelize (ORM), MySQL, JWT, bcryptjs
- Frontend: HTML, CSS, vanilla JavaScript (single-page app, no framework)
- The Express server also serves the frontend as static files, so the
  whole app runs from one process on one port.
- Uploaded media is stored locally in `backend/uploads/` and served by Express.

## Project structure

```
social-app/
├── backend/
│   ├── config/db.js          # Sequelize + MySQL connection
│   ├── models/                # User, Post, Comment, Like, Follow
│   ├── routes/                 # auth, users, posts, comments
│   ├── middleware/auth.js     # JWT verification
│   ├── seed.js                 # demo data
│   ├── server.js               # app entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js             # fetch wrapper + token handling
        └── app.js              # views, routing, rendering
```

## Setup

### 1. Prerequisites

- Node.js 18+
- MySQL 8+ running locally (or a reachable MySQL server)

### 2. Create the database

```sql
CREATE DATABASE ripple_db;
```

### 3. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your MySQL credentials and a JWT secret:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ripple_db
DB_USER=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=some_long_random_string
```

### 4. Install dependencies

```bash
npm install
```

### 5. Seed demo data (optional but recommended)

This creates the tables and fills them with 5 demo users, posts, comments,
likes, and follow relationships. **It drops and recreates all tables**, so
only run it on a fresh database.

```bash
npm run seed
```

Demo login for any seeded user — username `aria`, `devraj`, `nova`, `kabir`,
or `lena`, password `password123`.

### Demo profiles without resetting data

```bash
npm run seed:demo
```

This adds 20 `demo_*` profiles, sample posts, 10 video reels, likes, and follow relationships
without dropping existing tables or data. The first non-demo account follows
all 20 demo profiles by default. Set `DEMO_OWNER_USERNAME` to choose a different
account. Demo profiles use password `ripple-demo-2026`.

### Password changes and local recovery

Signed-in users can change their password from their own profile. If the password
is forgotten during local development, run this from `backend`:

```bash
npm run reset-password -- your-email@example.com
```

The command also accepts a username and prompts for the new password without
echoing it. Public email reset links are not enabled because this project has no
email delivery provider configured.

### 6. Run the server

```bash
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

Then open **http://localhost:5000** in your browser. The frontend is served
from the same server, so there's nothing else to run.

> If you skip the seed step, the server will still create empty tables on
> first run (via `sequelize.sync()`) — just register a new account from the
> sign-up tab.

## API overview

| Method | Endpoint                     | Auth | Description                    |
|--------|-------------------------------|------|---------------------------------|
| POST   | /api/auth/register             | –    | Create an account               |
| POST   | /api/auth/login                | –    | Log in, get a JWT               |
| GET    | /api/auth/me                   | ✓    | Current user                    |
| GET    | /api/users/:id                 | –    | Profile + stats                 |
| PUT    | /api/users/:id                 | ✓    | Update own profile              |
| GET    | /api/users/:id/posts           | –    | A user's posts                  |
| POST   | /api/users/:id/follow          | ✓    | Follow a user                   |
| DELETE | /api/users/:id/follow          | ✓    | Unfollow a user                 |
| GET    | /api/users/:id/followers        | –    | Follower list                   |
| GET    | /api/users/:id/following        | –    | Following list                  |
| GET    | /api/posts?feed=following       | –    | Feed (all, or following-only)   |
| POST   | /api/posts                      | ✓    | Create a post                   |
| GET    | /api/posts/:id                  | –    | Single post                     |
| DELETE | /api/posts/:id                  | ✓    | Delete own post                 |
| POST   | /api/posts/:id/like             | ✓    | Like a post                     |
| DELETE | /api/posts/:id/like             | ✓    | Unlike a post                   |
| GET    | /api/posts/:id/comments          | –    | Comments on a post              |
| POST   | /api/posts/:id/comments          | ✓    | Add a comment                   |
| DELETE | /api/comments/:id                | ✓    | Delete own comment              |

Authenticated requests need `Authorization: Bearer <token>`.

## Notes

- Passwords are hashed with bcrypt; never stored in plain text.
- The frontend stores the JWT in `localStorage` and attaches it to every
  API call automatically (see `frontend/js/api.js`).
- Avatars are set via a URL (no file upload) to keep the project dependency-free.
- `sequelize.sync()` in `server.js` will create any missing tables on boot,
  but won't alter existing ones — use the seed script for a clean slate.
