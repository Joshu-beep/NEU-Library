## Both Visitor and Admin 
### User: jcesperanza@neu.edu.ph | Pass: jcesperanza

# NEU Library Visitor Management System

A web-based visitor management system for the **New Era University Library**. Students and faculty check in using their institutional email, log their reason for visiting, and check out when they leave. Admins monitor live occupancy, view visit logs, manage users, post announcements, and scan QR codes — all in real time.

**Live site:** https://neu-library.vercel.app/

---

## Features

### For Students & Faculty
- Register and log in with `@neu.edu.ph` email only
- Select a visit reason: Reading, Researching, Use of Computer, or Meeting
- **"Welcome to NEU Library!"** popup after logging in — auto-closes in 3 seconds
- QR code download as a full-card image (name, program, NEU branding)
- Session timer showing how long you have been inside
- Visit history showing last 5 completed visits
- Monthly visit streak tracker
- Library hours pill showing open/closed status in PH time
- Live clock in navbar showing Philippine Standard Time

### For Admins
- Email + password login using registered `@neu.edu.ph` account
- Navbar shows logged-in admin name and role (Admin or Owner)
- Live occupancy count, today's visits, this week, and total registered users
- Currently Inside panel with real-time pulse indicators
- Daily visits bar chart (last 7 days) via Chart.js
- Full visit log table with date/time, name, program, reason, duration, and status
- Filter by date range or keyword
- Export to CSV or PDF
- Block/unblock users and delete accounts
- **Notices tab** — post Announcements with event dates and Reminders separately
- QR Scanner button (session-guarded, admin-only)
- Real-time auto-update via Supabase Realtime WebSocket subscriptions
- Auto midnight logout for stale "inside" records
- Custom background image support

### For the Owner (Super Admin)
- **Manage Admins tab** — visible only to the owner
- Assign admin access to any registered `@neu.edu.ph` account
- View all current admins with name, email, and role badge
- Remove admin access from any admin (owner cannot be removed)
- Assign unlimited admins

### QR Scanner (Admin Kiosk)
- Accessible only from the admin dashboard via session token
- Camera-based QR scanning using jsQR
- Check-in: shows user info and reason selection buttons
- Instant logout when scanning a user already inside — no confirmation needed
- Resets automatically after a few seconds for the next person

---

## Project Structure

```
/
├── index.html
├── visitorlog.html
├── admindashboard.html
├── qrscan.html
├── css/
│   ├── index.css
│   ├── visitorlog.css
│   ├── admindashboard.css
│   └── qrscan.css
├── js/
│   ├── index.js
│   ├── visitorlog.js
│   ├── admindashboard.js
│   └── qrscan.js
└── img/
    ├── neulogo.png
    ├── backgroundimg.jpg          # index.html background
    ├── visitorlog-bg.jpg          # visitorlog background (optional)
    ├── admindashboard-bg.jpg      # admindashboard background (optional)
    └── qrscan-bg.jpg              # qrscan background (optional)
```

> Background images are optional. Pages fall back to a solid color if the file is missing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (ES Modules) |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime) |
| QR Generation | [qrcodejs](https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js) |
| QR Scanning | [jsQR](https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js) |
| Charts | [Chart.js 4.4.0](https://cdn.jsdelivr.net/npm/chart.js@4.4.0) |
| Hosting | [Vercel](https://vercel.com) |
| Version Control | GitHub |

---

## Database Schema

Run these in **Supabase → SQL Editor**:

```sql
-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  program text,
  role text DEFAULT 'student',   -- 'student', 'faculty', 'admin', 'owner'
  is_blocked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Visit logs table
CREATE TABLE visit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  time_in timestamptz DEFAULT now(),
  time_out timestamptz,
  status text DEFAULT 'inside'
);

-- Notices table
CREATE TABLE notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text DEFAULT 'reminder',   -- 'event' or 'reminder'
  event_date date,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;

-- Set timezone
ALTER DATABASE postgres SET timezone TO 'Asia/Manila';

-- DB controls time_in
ALTER TABLE visit_logs ALTER COLUMN time_in SET DEFAULT now();
```

### Enable Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE visit_logs, users;
```

### Set the Owner

After registering your account as a visitor, run this once:

```sql
UPDATE users SET role = 'owner' WHERE email = 'your.email@neu.edu.ph';
```

The owner can then assign admins from the **Manage Admins** tab in the dashboard.

---

## Setup & Deployment

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Run the SQL above in **SQL Editor**
3. Go to **Authentication → Providers → Email** → turn off **Confirm email**
4. Copy your **Project URL** and **anon/public key** from **Settings → API**
5. Replace the credentials in all four files inside `js/`:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
```

### 2. GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 3. Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** → import your repo
3. Framework preset: **Other**
4. Click **Deploy**

Vercel auto-deploys on every push to `main`.

---

## Admin Login

Admins sign in using their registered `@neu.edu.ph` email and password — no separate credentials. The system checks the `users` table for `role = 'admin'` or `role = 'owner'` before granting access.

---

## Key Design Decisions

**JS separated from HTML** — all JavaScript lives in `js/`. Each page loads its own `.js` file. HTML files contain only structure and markup.

**Time handling** — all timestamps use Supabase server-side `now()`. The database timezone is `Asia/Manila` so all times are in Philippine Standard Time (UTC+8).

**Owner/Admin roles** — three privilege levels: visitors (`student`/`faculty`), `admin` (dashboard access), and `owner` (can also assign/remove admins). The owner role cannot be removed via the UI.

**QR security** — `qrscan.html` requires a `sessionStorage` token set only when clicking the QR Scanner button from the dashboard. Direct URL access redirects to login immediately.

**No email confirmation** — disabled in Supabase so students can register and log in right away.

**Realtime** — the admin dashboard subscribes to `visit_logs` and `users` via Supabase Realtime. Stats and tables update instantly on any check-in or checkout — no refresh needed.

**Instant QR logout** — scanning an already-inside user logs them out immediately with no extra confirmation, keeping the entrance queue moving.

**Background images** — each page supports a custom background. Drop the named file into `img/` to activate it. Falls back to solid color if missing.

---

## Pages Overview

### `index.html` — Login & Registration
- Split layout: login panel left, background image right
- Login, Register, and Admin Access views
- Domain restricted to `@neu.edu.ph`
- Announcement panel (top-right on desktop, hidden on mobile) shows live notices from Supabase

### `visitorlog.html` — Visitor Check-in
- Left panel: profile card, session timer, visit streak, recent visits
- Right panel: 2×2 square reason grid, Log Visit button, My QR Code, Logout
- "Welcome to NEU Library!" popup on successful check-in, closes after 3 seconds
- Shows "Already checked in" banner if user has an active visit today

### `admindashboard.html` — Admin Panel
- Stats row: Live Occupancy, Visits Today, This Week, Total Registered
- Daily visits bar chart + Currently Inside live table
- Tabs: Visits Log, Manage Users, Notices, Manage Admins (owner only)
- Navbar shows logged-in admin name and role

### `qrscan.html` — QR Kiosk
- Admin-only, guarded by `sessionStorage` token
- Tap to start camera → scan QR → check in or instant logout
- Auto-resets after each scan for the next person

---

## Responsive Design

All pages use CSS `clamp()` for fluid scaling:

| Screen | Behavior |
|---|---|
| 1600px+ | Wider panels, larger fonts |
| 1280–1599px | Standard desktop layout |
| 900–1279px | Slightly compressed, same structure |
| Below 900px | Single column, stacked panels |
| Below 640px | Compact mobile layout |
| Below 400px | Minimal — clock hidden, elements tightened |

---

## Browser Support

- Chrome, Edge, Firefox (latest versions)
- Safari on iOS/macOS (for QR scanner camera)
- HTTPS required for camera access (`getUserMedia`)
- Requires ES Modules, CSS `clamp()`, `localStorage`, `sessionStorage`

---

## License

Built for **New Era University** internal library use.
